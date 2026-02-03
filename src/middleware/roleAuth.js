// Role-based access control middleware
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.userRole
      });
    }

    next();
  };
}

// Specific role middlewares
const requireAdmin = requireRole('admin');
const requireSalesperson = requireRole(['admin', 'salesperson']);
const requireStorekeeper = requireRole(['admin', 'storekeeper']);
const requireStaff = requireRole(['admin', 'salesperson', 'storekeeper']);

module.exports = {
  requireRole,
  requireAdmin,
  requireStorekeeper,
  requireSalesperson,
  requireStaff,
};
