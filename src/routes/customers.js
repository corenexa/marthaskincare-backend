const express = require('express');
const auth = require('../middleware/auth');
const { requireSalesperson, requireAdmin } = require('../middleware/roleAuth');
const { createCustomer, listCustomers, getCustomerById, updateCustomer, deleteCustomer } = require('../models/customer');

const router = express.Router();

// All customer routes require authentication
router.use(auth);

// GET /api/customers - list all customers (admin and salesperson)
router.get('/', requireSalesperson, async (req, res) => {
  const customers = await listCustomers();
  return res.json({ customers });
});

// GET /api/customers/:id - get a customer by id (admin and salesperson)
router.get('/:id', requireSalesperson, async (req, res) => {
  const customer = await getCustomerById(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  return res.json({ customer });
});

// POST /api/customers - create customer (admin and salesperson)
router.post('/', requireSalesperson, async (req, res) => {
  const { name, businessAddress, contact, email } = req.body || {};
  if (!name || !businessAddress || !contact || !email) {
    return res.status(400).json({ error: 'name, businessAddress, contact, email are required' });
  }

  const created = await createCustomer({ name, businessAddress, contact, email });
  return res.status(201).json({ customer: created });
});

// PATCH /api/customers/:id - update customer (admin only)
router.patch('/:id', requireAdmin, async (req, res) => {
  const updated = await updateCustomer(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Customer not found' });
  return res.json({ customer: updated });
});

// DELETE /api/customers/:id - delete customer (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const deleted = await deleteCustomer(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Customer not found' });
  return res.json({ message: 'Customer deleted' });
});

module.exports = router;


