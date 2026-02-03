const express = require('express');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleAuth');
const { createExpense, listExpense, getExpenseById, updateExpense, deleteExpense } = require('../models/expense');

const router = express.Router();

// All expense routes require authentication
router.use(auth);

// GET /api/expense - list all expense (admin only)
router.get('/', requireAdmin, async (req, res) => {
  const expense = await listExpense();
  return res.json({ expense });
});

// GET /api/expense/:id - get an expense by id (admin only)
router.get('/:id', requireAdmin, async (req, res) => {
  const expense = await getExpenseById(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  return res.json({ expense });
});

// POST /api/expense - create expense (admin only)
router.post('/', requireAdmin, async (req, res) => {
  const { item, description, amount, submittedBy, date} = req.body || {};
  if (!item || !description || !amount || !submittedBy|| !date) {
    return res.status(400).json({ error: 'item, description, amount, submittedBy, date endDate are required'});
  }

  const created = await createExpense({ item, description, amount, submittedBy, date });
  return res.status(201).json({ expense: created });
});

// PATCH /api/expense/:id - update expense (admin only)
router.patch('/:id', requireAdmin, async (req, res) => {
  const { item, description, amount, submittedBy, date} = req.body || {};
  if (!item || !description || !amount || !submittedBy || !date) {
    return res.status(400).json({ error: 'item, description, amount, submittedBy, date is required' });
  }

  const updated = await updateExpense(req.params.id, { item, description, amount, submittedBy, date });
  if (!updated) return res.status(404).json({ error: 'Expense not found' });
  return res.json({ expense: updated });
});

// DELETE /api/expense/:id - delete expense (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const deleted = await deleteExpense(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Expense not found' });
  return res.json({ message: 'Expense deleted' });
});

module.exports = router;