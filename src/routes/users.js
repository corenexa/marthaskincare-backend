const express = require('express');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { requireAdmin, requireSalesperson } = require('../middleware/roleAuth');
const { listUsers, getUserById, updateUser, deleteUser, createUser } = require('../models/user');
const { invalidateAllUserSessions } = require('../models/session');

const router = express.Router();

router.use(auth);

// GET /api/users - list all users (admin only)
router.get('/', requireAdmin, async (req, res) => {
  const users = await listUsers();
  return res.json({ users });
});

// GET /api/users/:id - read a user (admin only)
router.get('/:id', requireAdmin, async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.passwordHash) delete user.passwordHash;
  return res.json({ user });
});

async function handleUserUpdate(req, res, targetId) {
  let targetUserId = targetId || req.params.id || (req.userId && req.userId.toString());
  if (!targetUserId || targetUserId === 'undefined') {
    targetUserId = req.userId && req.userId.toString();
  }
  if (!targetUserId) {
    return res.status(400).json({ error: 'Target user id is required' });
  }
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const isAdmin = req.userRole === 'admin';
  const isSelf = req.userId && req.userId.toString() === targetUserId;

  if (!isAdmin && !isSelf) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const allowed = {};

  if (typeof req.body.name === 'string') allowed.name = req.body.name;
  if (typeof req.body.username === 'string') allowed.username = req.body.username;
  if (typeof req.body.phone === 'string') allowed.phone = req.body.phone;

  if (typeof req.body.password === 'string' && req.body.password.trim().length > 0) {
    const salt = await bcrypt.genSalt(10);
    allowed.passwordHash = await bcrypt.hash(req.body.password, salt);
  }

  if (isAdmin) {
    if (typeof req.body.role === 'string' && ['admin', 'salesperson', 'storekeeper'].includes(req.body.role)) {
      allowed.role = req.body.role;
    }
    if (typeof req.body.status === 'string' && ['Active', 'Inactive'].includes(req.body.status)) {
      allowed.status = req.body.status;
    }
  }

  if (Object.keys(allowed).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const updated = await updateUser(targetUserId, allowed);
  if (!updated) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: updated });
}

// Self-update routes must be defined before parameterized routes
router.put('/profile/me', async (req, res) => {
  return handleUserUpdate(req, res, req.userId && req.userId.toString());
});
router.patch('/profile/me', async (req, res) => {
  return handleUserUpdate(req, res, req.userId && req.userId.toString());
});

// Update user by id (admin or self)
router.patch('/:id', async (req, res) => {
  return handleUserUpdate(req, res);
});

// PUT /api/users/:id - same logic as PATCH
router.put('/:id', async (req, res) => {
  return handleUserUpdate(req, res);
});

// DELETE /api/users/:id - delete a user (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const targetUserId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  // Optional: prevent deleting your own account to avoid locking admins out
  if (req.userId && req.userId.toString() === targetUserId) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  // Invalidate all active sessions for that user
  await invalidateAllUserSessions(targetUserId).catch(() => { });

  const removed = await deleteUser(targetUserId);
  if (!removed) return res.status(404).json({ error: 'User not found' });

  return res.status(204).send();
});

// POST /api/users - create a user (admin only)
router.post('/', requireAdmin, async (req, res) => {
  const user = await createUser(req.body);
  if (!user) return res.status(400).json({ error: 'Failed to create user' });
  return res.json({ user });
});


// GET /api/users/profile/me - get current user profile
router.get('/profile/me', async (req, res) => {
  const user = await getUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.passwordHash) delete user.passwordHash;
  return res.json({ user });
});

module.exports = router;


