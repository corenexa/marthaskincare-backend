const jwt = require('jsonwebtoken');
const { getSession } = require('../models/session');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

module.exports = async function auth(req, res, next) {
  try {
    const authHeader = req.get('Authorization') || req.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.userId = payload.sub || payload.userId;
        req.userRole = payload.role;
        req.sessionId = payload.sid;
        return next();
      } catch (err) {
        console.warn('JWT verification failed, falling back to session:', err.message);
      }
    }

    // Check if user is authenticated via session
    if (!req.session || !req.session.isAuthenticated || !req.session.sessionId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify session exists in database and is still valid
    const session = await getSession(req.session.sessionId);
    if (!session) {
      // Session not found or expired, clear the session
      return req.session.destroy(() => {
        return res.status(401).json({ error: 'Session expired or invalid' });
      });
    }

    // Add user info to request
    // Extract user ID - session.userId might be populated (object) or just an ObjectId (string)
    req.userId = session.userId;
    req.userRole = session.role;
    req.sessionId = session.sessionId;
    
    // If userId is an object (populated), extract just the ID
    if (typeof session.userId === 'object' && session.userId !== null) {
      req.userId = session.userId.id || session.userId._id;
      // Optionally store the full user object
      req.user = session.userId;
    }
    
    return next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};