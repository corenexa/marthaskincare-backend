const express = require('express');
const { Product } = require('../models/product');
const { Order, createOrder, listOrders, getOrderById, updateOrder, deleteOrder } = require('../models/order');
const auth = require('../middleware/auth');
const { requireAdmin, requireSalesperson } = require('../middleware/roleAuth');

const router = express.Router();

function toNumber(value, fallback = 0) {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (Number.isNaN(num)) {
    return fallback;
  }
  return num;
}

router.post('/', async (req, res) => {
  try {
    const {
      receiptCode,
      orderNumber,
      items = [],
      customer = {},
      customerName,
      contact,
      address,
      shippingAddress = {},
      notes,
      paymentReference,
      metadata,
      discount = 0,
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart items are required' });
    }

    const dbIds = [];
    const productCodes = [];
    for (const item of items) {
      if (item.id) {
        dbIds.push(item.id);
      } else if (item.productId) {
        productCodes.push(item.productId);
      }
    }

    let productMap = new Map();
    if (dbIds.length > 0 || productCodes.length > 0) {
      const orClauses = [];
      if (dbIds.length > 0) orClauses.push({ _id: { $in: dbIds } });
      if (productCodes.length > 0) orClauses.push({ productId: { $in: productCodes } });

      const products = await Product.find(orClauses.length > 0 ? { $or: orClauses } : {}).exec();

      // Build lookup map allowing both _id and productId keys
      productMap = new Map();
      products.forEach((product) => {
        productMap.set(product._id.toString(), product);
        if (product.productId) {
          productMap.set(`code:${product.productId}`, product);
        }
      });

      const requestedCount = dbIds.length + productCodes.length;
      if (requestedCount > 0 && products.length === 0) {
        return res.status(400).json({ error: 'One or more products could not be found' });
      }
    }

    const normalizedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const productKey = item.id
        ? item.id.toString()
        : item.productId
          ? `code:${item.productId}`
          : null;
      const quantity = toNumber(item.quantity, 1);

      if (quantity < 1) {
        return res.status(400).json({ error: 'Quantity must be at least 1' });
      }

      let price = toNumber(item.price, 0);
      let name = item.name;

      if (productKey) {
        const product = productMap.get(productKey);
        if (!product) {
          return res.status(400).json({ error: `Product ${item.id || item.productId} not found` });
        }
        price = toNumber(product.price, 0);
        name = product.productName;
        const lineTotal = price * quantity;
        subtotal += lineTotal;
        normalizedItems.push({
          productId: product._id,
          name,
          price,
          quantity,
          image: item.image || product.productImage || null,
        });
        continue;
      }
      const lineTotal = price * quantity;
      subtotal += lineTotal;
      normalizedItems.push({
        productId: undefined,
        name,
        price,
        quantity,
        image: item.image || null,
      });
    }

    const discountValue = Math.max(toNumber(discount, 0), 0);
    const total = Math.max(subtotal - discountValue, 0);

    const resolvedReceiptCode = receiptCode || req.body.orderId || null;
    const resolvedOrderNumber = orderNumber || resolvedReceiptCode || null;

    const order = await createOrder({
      receiptCode: resolvedReceiptCode,
      orderNumber: resolvedOrderNumber,
      items: normalizedItems,
      subtotal,
      discount: discountValue,
      total,
      status: 'pending',
      paymentStatus: 'pending',
      paymentReference,
      customer: {
        name: customer.name || customer.fullName || customerName || '',
        email: customer.email || customer.emailAddress || '',
        phone: customer.phone || customer.contact || contact || '',
      },
      shippingAddress: {
        address: shippingAddress.address || shippingAddress.line1 || address || '',
      },
      notes,
      metadata,
    });

    return res.status(201).json({ order });
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({ error: 'Failed to create order' });
  }
});

router.use(auth);

router.get('/', requireSalesperson, async (req, res) => {
  try {
    const { status, paymentStatus } = req.query;
    const orders = await listOrders({ status, paymentStatus });
    return res.json({ orders });
  } catch (error) {
    console.error('Error listing orders:', error);
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.get('/:id', requireSalesperson, async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    return res.json({ order });
  } catch (error) {
    console.error('Error fetching order:', error);
    return res.status(500).json({ error: 'Failed to fetch order' });
  }
});

router.patch('/:id', requireSalesperson, async (req, res) => {
  try {
    const { status, paymentStatus, notes, shippingAddress, customer, paymentReference } = req.body || {};

    if (!status && !paymentStatus && !notes && !shippingAddress && !customer && !paymentReference) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const existing = await Order.findById(req.params.id).exec();
    if (!existing) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const nextStatus = typeof status === 'string' ? status : existing.status;
    const shouldDeductInventory = nextStatus === 'completed' && !existing.inventoryAdjusted;
    const shouldRestoreInventory = nextStatus === 'cancelled' && existing.inventoryAdjusted;

    let productItemsForAdjustment = [];
    let productMapForAdjustment = new Map();

    if (shouldDeductInventory || shouldRestoreInventory) {
      productItemsForAdjustment = existing.items.filter((item) => item.productId);

      if (productItemsForAdjustment.length > 0) {
        const productIds = productItemsForAdjustment.map((item) => item.productId);
        const products = await Product.find({ _id: { $in: productIds } }).exec();
        productMapForAdjustment = new Map(products.map((p) => [p._id.toString(), p]));
      }
    }

    if (shouldDeductInventory && productItemsForAdjustment.length > 0) {
      for (const item of productItemsForAdjustment) {
        const product = productMapForAdjustment.get(item.productId.toString());
        if (!product) {
          return res.status(400).json({ error: `Product ${item.productId} no longer exists` });
        }
        const availableQty = typeof product.quantity === 'number' ? product.quantity : 0;
        if (availableQty < item.quantity) {
          return res.status(400).json({
            error: `Insufficient stock for ${product.productName}. Available: ${availableQty}, Required: ${item.quantity}`,
          });
        }
      }
    }

    const updated = await updateOrder(req.params.id, {
      status,
      paymentStatus,
      notes,
      shippingAddress,
      customer,
      paymentReference,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Order not found' });
    }

    let finalOrder = updated;

    if (shouldDeductInventory && productItemsForAdjustment.length > 0) {
      for (const item of productItemsForAdjustment) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { quantity: -item.quantity },
        }).exec();
      }

      const adjusted = await updateOrder(req.params.id, { inventoryAdjusted: true });
      if (adjusted) {
        finalOrder = adjusted;
      } else {
        finalOrder = { ...finalOrder, inventoryAdjusted: true };
      }
    }

    if (shouldRestoreInventory && productItemsForAdjustment.length > 0) {
      for (const item of productItemsForAdjustment) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { quantity: item.quantity },
        }).exec();
      }

      const adjusted = await updateOrder(req.params.id, { inventoryAdjusted: false });
      if (adjusted) {
        finalOrder = adjusted;
      } else {
        finalOrder = { ...finalOrder, inventoryAdjusted: false };
      }
    }

    return res.json({ order: finalOrder });
  } catch (error) {
    console.error('Error updating order:', error);
    return res.status(500).json({ error: 'Failed to update order' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await deleteOrder(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Order not found' });
    }
    return res.json({ message: 'Order deleted' });
  } catch (error) {
    console.error('Error deleting order:', error);
    return res.status(500).json({ error: 'Failed to delete order' });
  }
});

module.exports = router;


