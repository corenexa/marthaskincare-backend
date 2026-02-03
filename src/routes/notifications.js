const express = require('express');
const auth = require('../middleware/auth');
const { requireStorekeeper, requireAdmin } = require('../middleware/roleAuth');
const {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../models/notification');

const router = express.Router();

// All notification routes require authentication
router.use(auth);

// GET /api/notifications - list notifications (admin and storekeeper)
// Query params: ?isRead=true/false, ?limit=50
router.get('/', requireStorekeeper, async (req, res) => {
  const isRead = req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined;
  const limit = parseInt(req.query.limit) || 100;

  const notifications = await listNotifications({ isRead, limit });
  return res.json({ notifications });
});

// GET /api/notifications/count - get unread notification count
router.get('/count', requireStorekeeper, async (req, res) => {
  const count = await getUnreadCount();
  return res.json({ unreadCount: count });
});

// PATCH /api/notifications/:id/read - mark notification as read
router.patch('/:id/read', requireStorekeeper, async (req, res) => {
  const notification = await markAsRead(req.params.id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  return res.json({ notification });
});

// PATCH /api/notifications/read-all - mark all notifications as read
router.patch('/read-all', requireStorekeeper, async (req, res) => {
  const count = await markAllAsRead();
  return res.json({ message: `${count} notifications marked as read` });
});

// DELETE /api/notifications/:id - delete a notification (optional cleanup)
router.delete('/:id', requireAdmin, async (req, res) => {
  const deleted = await deleteNotification(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Notification not found' });
  return res.json({ message: 'Notification deleted' });
});

module.exports = router;


