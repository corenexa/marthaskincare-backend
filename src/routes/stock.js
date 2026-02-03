const express = require('express');
const auth = require('../middleware/auth');
const { requireStorekeeper, requireAdmin } = require('../middleware/roleAuth');
const { Stock, createStock, listStocks, getStockById, updateStock, deleteStock } = require('../models/stock');

const router = express.Router();

// All stock routes require authentication
router.use(auth);

// GET /api/stocks - list all stocks (admin and storekeeper only)
router.get('/', requireStorekeeper, async (req, res) => {
  const stocks = await listStocks();
  return res.json({ stocks });
});

// GET /api/stocks/:id - get a stock by database id (admin and storekeeper only)
router.get('/:id', requireStorekeeper, async (req, res) => {
  const stock = await getStockById(req.params.id);
  if (!stock) return res.status(404).json({ error: 'Stock not found' });
  return res.json({ stock });
});

// POST /api/stocks - create stock (admin and storekeeper only)
router.post('/', requireStorekeeper, async (req, res) => {
  const {
    productId,
    quantity,
    price,
    total,
    date,
    supplier,
    image,
    notes,
  } = req.body || {};

  // Validate required fields (image is optional, productCode is auto-generated)
  if (!productId || quantity === undefined || quantity === null || typeof quantity !== 'number' ||
    price === undefined || price === null || typeof price !== 'number' ||
    total === undefined || total === null || typeof total !== 'number' ||
    !date || !supplier || !notes) {
    return res.status(400).json({ error: 'productId, quantity, price, total, date, supplier, notes are required' });
  }

  // Validate numeric values are non-negative
  if (quantity < 0 || price < 0 || total < 0) {
    return res.status(400).json({ error: 'quantity, price, and total must be non-negative' });
  }

  // Generate unique 4-character alphanumeric productCode
  const generateProductCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Ensure uniqueness
  let productCode;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loop

  while (!isUnique && attempts < maxAttempts) {
    productCode = generateProductCode();
    const existing = await Stock.findOne({ productCode });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    return res.status(500).json({ error: 'Failed to generate unique product code' });
  }

  const created = await createStock({
    productId,
    quantity,
    price,
    total,
    productCode,
    date,
    supplier,
    image: image || null,
    notes,
  });

  // Check for notifications after creating stock
  return res.status(201).json({ stock: created });
});

// PATCH /api/stocks/:id - update stock (admin and storekeeper only)
router.patch('/:id', requireStorekeeper, async (req, res) => {
  const updated = await updateStock(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Stock not found' });

  return res.json({ stock: updated });
});

// DELETE /api/stocks/:id - delete stock (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const deleted = await deleteStock(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Stock not found' });
  return res.json({ message: 'Stock deleted' });
});

module.exports = router;
