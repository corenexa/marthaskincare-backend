const express = require('express');
const auth = require('../middleware/auth');
const { requireAdmin, requireHR } = require('../middleware/roleAuth');
const { createSalary, listSalaries, getSalaryById, getSalaryByEmployeeAndMonth, updateSalary, deleteSalary } = require('../models/salary');

const router = express.Router();

// All salary routes require authentication
router.use(auth);

// GET /api/salaries - list all salaries (HR and admin only)
router.get('/', requireAdmin, async (req, res) => {

    const salaries = await listSalaries();
    return res.json({ salaries });
});

// GET /api/salaries/:id - get a salary by id (HR and admin only)
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const salary = await getSalaryById(req.params.id);
    if (!salary) return res.status(404).json({ error: 'Salary not found' });
    return res.json({ salary });
  } catch (error) {
    console.error('Error getting salary:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/salaries - create salary (HR and admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { employeeId, month, year, paymentStatus, paymentDate, transactionId } = req.body || {};

    if (!employeeId || !month || !year) {
      return res.status(400).json({ error: 'employeeId, month, and year are required' });
    }

    // Check if salary record already exists for this employee and month
    const existing = await getSalaryByEmployeeAndMonth(employeeId, month);
    if (existing) {
      // If exists, update it instead of creating new
      const updated = await updateSalary(existing.id, {
        paymentStatus: paymentStatus || existing.paymentStatus,
        paymentDate: paymentDate ? new Date(paymentDate) : existing.paymentDate,
        transactionId: transactionId || existing.transactionId,
      });
      return res.json({ salary: updated });
    }

    const created = await createSalary({
      employeeId,
      month,
      year,
      paymentStatus: paymentStatus || 'unpaid',
      paymentDate: paymentDate ? new Date(paymentDate) : undefined,
      transactionId: transactionId || undefined,
    });

    return res.status(201).json({ salary: created });
  } catch (error) {
    console.error('Error creating salary:', error);
    if (error.code === 11000) {
      // Duplicate key error - record already exists
      const existing = await getSalaryByEmployeeAndMonth(req.body.employeeId, req.body.month);
      if (existing) {
        const updated = await updateSalary(existing.id, req.body);
        return res.json({ salary: updated });
      }
      return res.status(400).json({ error: 'Salary record already exists for this employee and month' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/salaries/:id - update salary (HR and admin only)
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const updated = await updateSalary(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Salary not found' });
    return res.json({ salary: updated });
  } catch (error) {
    console.error('Error updating salary:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/salaries/:id - delete salary (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await deleteSalary(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Salary not found' });
    return res.json({ message: 'Salary deleted' });
  } catch (error) {
    console.error('Error deleting salary:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;