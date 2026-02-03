const express = require('express');
const Sale = require('../models/sales');
const { Product } = require('../models/product');
const { getUserById } = require('../models/user');
const auth = require('../middleware/auth');
const { requireSalesperson, requireAdmin } = require('../middleware/roleAuth');
const mongoose = require('mongoose');
const router = express.Router();

const useMongoTransactions = process.env.MONGO_USE_TRANSACTIONS === 'true';

// Apply authentication to all sales routes
router.use(auth);
// @route   POST /api/sales
// @desc    Create a new sale and deduct inventory
// @access  Private
router.post('/', requireSalesperson, async (req, res) => {
  const session = useMongoTransactions ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }
  const abortIfSession = async () => {
    if (session) {
      await session.abortTransaction();
    }
  };

  try {
    const {
      items,
      paymentMethod = 'cash',
      notes,
      discount = 0,
      subtotal: frontendSubtotal,
      total: frontendTotal
    } = req.body;

    // Validate items
    if (!items || items.length === 0) {
      await abortIfSession();
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Frontend sends items with 'id' field, map to productId for backend
    const productIds = items.map(item => item.id || item.productId);
    const productsQuery = Product.find({ _id: { $in: productIds } });
    const products = session ? await productsQuery.session(session) : await productsQuery;

    if (products.length !== productIds.length) {
      await abortIfSession();
      return res.status(400).json({ error: 'Some products not found' });
    }

    // Create product map for quick lookup
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    // 2. Validate stock and build sale items
    let subtotal = 0;
    const saleItems = [];

    for (const item of items) {
      const productId = item.id || item.productId;
      const product = productMap.get(productId.toString());

      if (!product) {
        await abortIfSession();
        return res.status(400).json({ error: `Product ${productId} not found` });
      }

      // Convert price from string to number if needed
      const productPrice = typeof product.price === 'string'
        ? parseFloat(product.price) || 0
        : product.price || 0;

      // Check if expired (use expiringDate field from product model)
      if (product.expiringDate && new Date(product.expiringDate) < new Date()) {
        await abortIfSession();
        return res.status(400).json({
          error: `Product ${product.productName} has expired`
        });
      }

      // Check stock availability
      if (!product.quantity || product.quantity < item.quantity) {
        await abortIfSession();
        return res.status(400).json({
          error: `Insufficient stock for ${product.productName}. Available: ${product.quantity || 0}, Requested: ${item.quantity}`
        });
      }

      const itemTotal = productPrice * item.quantity;
      subtotal += itemTotal;

      saleItems.push({
        productId: product._id,
        productName: product.productName,
        quantity: item.quantity,
        unitPrice: productPrice,
        totalPrice: itemTotal
      });
    }

    // 3. Calculate totals (use frontend totals if provided, otherwise calculate)
    const discountAmount = discount || 0;
    const calculatedSubtotal = frontendSubtotal || subtotal;
    const calculatedTotal = frontendTotal;

    // 4. Generate unique sale number
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');

    const countQuery = Sale.countDocuments({
      createdAt: {
        $gte: new Date(today.setHours(0, 0, 0, 0))
      }
    });
    const count = session ? await countQuery.session(session) : await countQuery;

    const saleNumber = `SALE-${dateStr}-${String(count + 1).padStart(4, '0')}`;

    // Get user ID from auth middleware (now properly extracted by auth middleware)
    const userId = req.userId;

    if (!userId) {
      await abortIfSession();
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // 5. Create sale record
    const sale = new Sale({
      saleNumber,
      items: saleItems,
      subtotal: calculatedSubtotal,
      discount: discountAmount,
      totalAmount: calculatedTotal,
      paymentMethod,
      paymentStatus: 'completed',
      notes,
      cashierId: userId
    });

    if (session) {
      await sale.save({ session });
    } else {
      await sale.save();
    }

    // 6. CRITICAL: Update product quantities
    for (const item of items) {
      const productId = item.id || item.productId;
      await Product.findByIdAndUpdate(
        productId,
        {
          $inc: { quantity: -item.quantity }
        },
        session ? { session } : {}
      );
    }

    // Commit transaction
    if (session) {
      await session.commitTransaction();
    }

    // Get user details to populate
    const user = await getUserById(userId);
    if (user) {
      sale.cashierId = { id: user.id, name: user.name, email: user.email };
    }

    res.status(201).json({
      success: true,
      sale,
      message: 'Sale completed successfully'
    });

  } catch (error) {
    await abortIfSession();
    console.error('Error processing sale:', error);
    res.status(500).json({
      error: error.message || 'Failed to process sale'
    });
  } finally {
    if (session) {
      session.endSession();
    }
  }
});

// @route   GET /api/sales
// @desc    Get all sales with filters and pagination
// @access  Private
router.get('/', requireSalesperson, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      paymentMethod,
      search
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = {};

    // Date filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }

    // Search filter
    if (search) {
      query.$or = [
        { saleNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const [sales, total] = await Promise.all([
      Sale.find(query)
        .populate('cashierId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Sale.countDocuments(query)
    ]);

    res.json({
      sales,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// @route   GET /api/sales/stats
// @desc    Get sales statistics
// @access  Private
router.get('/stats', requireSalesperson, async (req, res) => {
  try {
    const { period = 'today' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;

    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0));
    }

    // Get sales for the period
    const sales = await Sale.find({
      createdAt: { $gte: startDate },
      paymentStatus: 'completed'
    });

    // Calculate statistics
    const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalTransactions = sales.length;
    const totalItemsSold = sales.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );
    const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    // Calculate trend
    const periodLength = Date.now() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);

    const previousSales = await Sale.find({
      createdAt: {
        $gte: previousStartDate,
        $lt: startDate
      },
      paymentStatus: 'completed'
    });

    const previousTotal = previousSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const salesTrend = previousTotal > 0
      ? ((totalSales - previousTotal) / previousTotal) * 100
      : 0;

    // Top products
    const productSales = new Map();

    sales.forEach(sale => {
      sale.items.forEach(item => {
        const existing = productSales.get(item.productId.toString()) || {
          name: item.productName,
          quantity: 0,
          revenue: 0
        };
        productSales.set(item.productId.toString(), {
          name: item.productName,
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + item.totalPrice
        });
      });
    });

    const topProducts = Array.from(productSales.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Payment method breakdown
    const paymentMethods = sales.reduce((acc, sale) => {
      acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + 1;
      return acc;
    }, {});

    res.json({
      period,
      totalSales,
      totalTransactions,
      totalItemsSold,
      averageTransaction,
      salesTrend: parseFloat(salesTrend.toFixed(2)),
      topProducts,
      paymentMethods
    });

  } catch (error) {
    console.error('Error fetching sales stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// @route   GET /api/sales/daily
// @desc    Get today's sales statistics
// @access  Private
router.get('/daily', requireSalesperson, async (req, res) => {
  try {
    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Get today's sales
    const sales = await Sale.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      paymentStatus: 'completed'
    });

    // Calculate statistics
    const totalSales = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalTransactions = sales.length;
    const itemsSold = sales.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );
    const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    // Calculate trend (compare with yesterday)
    const yesterday = new Date(startOfDay);
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdaySales = await Sale.find({
      createdAt: {
        $gte: yesterday,
        $lt: startOfDay
      },
      paymentStatus: 'completed'
    });

    const yesterdayTotal = yesterdaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const salesTrend = yesterdayTotal > 0
      ? ((totalSales - yesterdayTotal) / yesterdayTotal) * 100
      : (totalSales > 0 ? 100 : 0);

    res.json({
      totalSales,
      totalTransactions,
      itemsSold,
      averageTransaction: parseFloat(averageTransaction.toFixed(2)),
      salesTrend: parseFloat(salesTrend.toFixed(2))
    });

  } catch (error) {
    console.error('Error fetching daily sales:', error);
    res.status(500).json({ error: 'Failed to fetch daily sales' });
  }
});

// @route   PATCH /api/sales/:id
// @desc    Update sale status/payment info
// @access  Private
router.patch('/:id', requireSalesperson, async (req, res) => {
  try {
    const {
      paymentStatus,
      paymentMethod,
      notes,
      discount,
      subtotal,
      totalAmount
    } = req.body || {};

    if (
      typeof paymentStatus === 'undefined' &&
      typeof paymentMethod === 'undefined' &&
      typeof notes === 'undefined' &&
      typeof discount === 'undefined' &&
      typeof subtotal === 'undefined' &&
      typeof totalAmount === 'undefined'
    ) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const allowed = {};
    if (typeof paymentStatus === 'string') allowed.paymentStatus = paymentStatus;
    if (typeof paymentMethod === 'string') allowed.paymentMethod = paymentMethod;
    if (typeof notes === 'string') allowed.notes = notes;
    if (typeof discount === 'number') allowed.discount = discount;
    if (typeof subtotal === 'number') allowed.subtotal = subtotal;
    if (typeof totalAmount === 'number') allowed.totalAmount = totalAmount;

    const updatedSale = await Sale.findByIdAndUpdate(
      req.params.id,
      allowed,
      { new: true }
    )
      .populate('cashierId', 'name email')
      .exec();

    if (!updatedSale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    return res.json({ sale: updatedSale });
  } catch (error) {
    console.error('Error updating sale:', error);
    return res.status(500).json({ error: 'Failed to update sale' });
  }
});

// @route   GET /api/sales/:id
// @desc    Get single sale by ID
// @access  Private
router.get('/:id', requireSalesperson, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('cashierId', 'name email')
      .populate('items.productId');

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    res.json(sale);
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
});

// @route   DELETE /api/sales/:id
// @desc    Refund sale and restore inventory (Admin only)
// @access  Private/Admin
router.delete('/:id', requireAdmin, async (req, res) => {
  const session = useMongoTransactions ? await mongoose.startSession() : null;
  if (session) {
    session.startTransaction();
  }
  const abortIfSession = async () => {
    if (session) {
      await session.abortTransaction();
    }
  };

  try {

    const saleQuery = Sale.findById(req.params.id);
    const sale = session ? await saleQuery.session(session) : await saleQuery;

    if (!sale) {
      await abortIfSession();
      return res.status(404).json({ error: 'Sale not found' });
    }

    if (sale.paymentStatus === 'refunded') {
      await abortIfSession();
      return res.status(400).json({ error: 'Sale already refunded' });
    }

    // Restore product quantities
    for (const item of sale.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        {
          $inc: { quantity: item.quantity }
        },
        session ? { session } : {}
      );
    }

    // Update sale status
    sale.paymentStatus = 'refunded';
    if (session) {
      await sale.save({ session });
      await session.commitTransaction();
    } else {
      await sale.save();
    }

    res.json({
      success: true,
      message: 'Sale refunded successfully',
      sale
    });

  } catch (error) {
    await abortIfSession();
    console.error('Error refunding sale:', error);
    res.status(500).json({
      error: error.message || 'Failed to refund sale'
    });
  } finally {
    if (session) {
      session.endSession();
    }
  }
});

module.exports = router;