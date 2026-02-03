const express = require('express');
const auth = require('../middleware/auth');
const { requireAdmin, requireStorekeeper } = require('../middleware/roleAuth');
const { createSupplier, listSupplier, getSupplierById, updateSupplier, deleteSupplier } = require('../models/suppliers');

const router = express.Router();

// All supplier routes require authentication
router.use(auth);

// GET /api/supplier - list all suppliers (admin and storekeeper)
router.get('/', requireStorekeeper, async (req, res) => {
  const supplier = await listSupplier();
  return res.json({ supplier });
});

// GET /api/supplier/:id - get an supplier by id (admin and storekeeper)
router.get('/:id', requireStorekeeper, async (req, res) => {
  const supplier = await getSupplierById(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
  return res.json({ supplier });
});

// POST /api/suppliers - create suppliers (admin and storekeeper)
router.post('/', requireStorekeeper, async (req, res) => {
  const { name, address, email, contact } = req.body || {};
  if (!name || !address || !email || !contact) {
    return res.status(400).json({ error: 'name, address, email, contact, is required' });
  }

  const created = await createSupplier({ name, address, email, contact });
  return res.status(201).json({ supplier: created });
});

// PATCH /api/suppliers/:id - update suppliers (admin and storekeeper)
router.patch('/:id', requireStorekeeper, async (req, res) => {
  const { name, address, email, contact } = req.body || {};
  if (!name || !address || !email || !contact) {
    return res.status(400).json({ error: 'name, address, email, contact, is required' });
  }

  const updated = await updateSupplier(req.params.id, { name, address, email, contact });
  if (!updated) return res.status(404).json({ error: 'Supplier not found' });
  return res.json({ supplier: updated });
});

// DELETE /api/suppliers/:id - delete suppliers (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const deleted = await deleteSupplier(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Suppliers not found' });
  return res.json({ message: 'Supplier deleted' });
});

module.exports = router;
