const express = require('express');
const auth = require('../middleware/auth');
const { requireAdmin, requireSalesperson, requireStorekeeper, requireStaff } = require('../middleware/roleAuth');
const { createProduct, listProducts, getProductById, updateProduct, deleteProduct, getProductByProductId } = require('../models/product');
const { checkProductForNotifications } = require('../utils/notificationChecker');

const router = express.Router();

// All product routes require authentication
router.use(auth);

// GET /api/products - list all products (all authenticated staff)
router.get('/', requireStaff, async (req, res) => {
  const products = await listProducts();
  return res.json({ products });
});

// GET /api/products/:id - get a product by database id (all authenticated staff)
router.get('/:id', requireStaff, async (req, res) => {
  const product = await getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  return res.json({ product });
});

// POST /api/products - create product (storekeeper and admin)
router.post('/', requireStorekeeper, async (req, res) => {
  const {
    // new required inputs
    category,
    productName,
    price,
    notes,
    productId,
    expiringDate,
    quantity,
    productImage,
    publishStatus,
  } = req.body || {};

  if (!category || !productName || !price || !notes) {
    return res.status(400).json({ error: 'category, productName, price, notes are required' });
  }

  if (productId) {
    const existing = await getProductByProductId(productId);
    if (existing) {
      return res.status(409).json({ error: 'productId already exists' });
    }
  }

  const created = await createProduct({
    category,
    productName,
    price,
    notes,
    productId: productId || null,
    expiringDate: expiringDate ? new Date(expiringDate) : null,
    quantity: typeof quantity === 'number' ? quantity : null,
    productImage: productImage || null,
    publishStatus: publishStatus || 'yes',
  });

  // Check for notifications after creating product
  checkProductForNotifications(created).catch((err) => {
    console.error('Error checking notifications for new product:', err);
  });

  return res.status(201).json({ product: created });
});

// PATCH /api/products/:id - update product (storekeeper and admin)
router.patch('/:id', requireAdmin, requireStorekeeper, async (req, res) => {
  const updated = await updateProduct(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Product not found' });

  // Check for notifications after updating product
  checkProductForNotifications(updated).catch((err) => {
    console.error('Error checking notifications for updated product:', err);
  });

  return res.json({ product: updated });
});

// DELETE /api/products/:id - delete product (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const deleted = await deleteProduct(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Product not found' });
  return res.json({ message: 'Product deleted' });
});

module.exports = router;
