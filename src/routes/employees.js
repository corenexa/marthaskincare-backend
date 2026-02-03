const express = require('express');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleAuth');
const { createEmployee, listEmployees, getEmployeeById, updateEmployee, deleteEmployee } = require('../models/employee');

const router = express.Router();

// All employee routes require authentication
router.use(auth);

// GET /api/employees - list all employees (admin only)
router.get('/', requireAdmin, async (req, res) => {
  const employees = await listEmployees();
  return res.json({ employees });
});

// GET /api/employees/:id - get an employee by id (admin only)
router.get('/:id', requireAdmin, async (req, res) => {
  const employee = await getEmployeeById(req.params.id);
  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  return res.json({ employee });
});

// POST /api/employees - create employee (admin only)
router.post('/', requireAdmin, async (req, res) => {
  const { name, address, email, contact, position, branch, educationLevel, department, gender, nationality, cv, status, startDate, endDate, salary } = req.body || {};
  if (!name || !address || !email || !contact || !position || !branch || !educationLevel || !department || !gender || !nationality || !cv || !status || !startDate || !endDate || !salary) {
    return res.status(400).json({ error: 'name, address, email, contact, position, branch, educationLevel, department, gender, nationality, cv, status, startDate, endDate are required', salary: 'salary is required' });
  }

  const created = await createEmployee({ name, address, email, contact, position, branch, educationLevel, department, gender, nationality, cv, status, startDate, endDate, salary });
  return res.status(201).json({ employee: created });
});

// PATCH /api/employees/:id - update employee (admin only)
router.patch('/:id', requireAdmin, async (req, res) => {
  const { name, address, email, contact, position, branch, educationLevel, department, gender, nationality, cv, status, startDate, endDate, salary } = req.body || {};
  if (!name || !address || !email || !contact || !position || !branch || !educationLevel || !department || !gender || !nationality || !cv || !status || !startDate || !endDate || !salary) {
    return res.status(400).json({ error: 'name, address, email, contact, position, branch, educationLevel, department, gender, nationality, cv, status, startDate, endDate are required', salary: 'salary is required' });
  }

  const updated = await updateEmployee(req.params.id, { name, address, email, contact, position, branch, educationLevel, department, gender, nationality, cv, status, startDate, endDate, salary });
  if (!updated) return res.status(404).json({ error: 'Employee not found' });
  return res.json({ employee: updated });
});

// DELETE /api/employees/:id - delete employee (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const deleted = await deleteEmployee(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Employee not found' });
  return res.json({ message: 'Employee deleted' });
});

module.exports = router;