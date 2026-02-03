const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { getUserByUsername, createUser, getUserById, listUsers } = require('../models/user');
const { createSession, getSession, invalidateSession, invalidateAllUserSessions } = require('../models/session');
const auth = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generateAuthToken(user, sessionId) {
  const payload = {
    sub: user.id || user._id,
    role: user.role,
    sid: sessionId
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

async function createUserSession(user, req) {
  try {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    // Ensure sessionId is not null or empty
    if (!sessionId) {
      throw new Error('Failed to generate session ID');
    }
    
    await createSession({
      sessionId,
      userId: user.id,
      role: user.role,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip || req.connection.remoteAddress,
      expiresAt
    });

    // Store session info in express-session
    req.session.sessionId = sessionId;
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.isAuthenticated = true;
    
    return sessionId;
  } catch (error) {
    console.error('Error creating user session:', error);
    throw error;
  }
}

router.post('/signup', async (req, res) => {
  try {
    const { name, username, password, role = 'salesperson' } = req.body || {};
    if (!name || !username || !password) {
      return res.status(400).json({ error: 'name, username, and password are required' });
    }

    const existing = await getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already in use' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const user = await createUser({ name, username, passwordHash, role });

    let sessionId;
    try {
      sessionId = await createUserSession(user, req);
    } catch (sessionError) {
      console.error('Session creation failed during signup:', sessionError);
      return res.status(500).json({ error: 'Failed to create session' });
    }
    const token = generateAuthToken(user, sessionId);
    
    // Explicitly save session (important for serverless environments like Vercel)
    req.session.save((err) => {
      if (err) {
        console.error('Session save error during signup:', err);
        return res.status(500).json({ error: 'Failed to save session' });
      }
      
      const { passwordHash: _, ...userWithoutPassword } = user;
      return res.status(201).json({ 
        message: 'User created successfully',
        user: userWithoutPassword,
        token,
        redirectUrl: getRedirectUrlByRole(user.role)
      });
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Failed to signup' });
  }
});

function getRedirectUrlByRole(role) {
  // All roles redirect to the same dashboard - frontend will handle role-based rendering
  return '/dashboard';
}

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Invalidate any existing sessions for this user
    await invalidateAllUserSessions(user.id);

    // Create new session
    const sessionId = await createUserSession(user, req);
    const token = generateAuthToken(user, sessionId);
    
    // Explicitly save session (important for serverless environments like Vercel)
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Failed to save session' });
      }
      
      const { passwordHash: _, ...userWithoutPassword } = user.toObject ? user.toObject() : user;
      delete userWithoutPassword.passwordHash;
      
      return res.json({ 
        message: 'Login successful',
        user: userWithoutPassword,
        token,
        redirectUrl: getRedirectUrlByRole(user.role)
      });
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Handle both document and plain object responses
    const userObj = user.toObject ? user.toObject() : user;
    const { passwordHash, ...rest } = userObj;
    
    return res.json({ 
      user: rest,
      redirectUrl: '/dashboard' // All users redirect to the same dashboard
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to load user' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    if (req.session && req.session.sessionId) {
      await invalidateSession(req.session.sessionId);
    }
    
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
          return res.status(500).json({ error: 'Failed to logout' });
        }
        
        // Clear cookie with same settings as session cookie
        const isProduction = process.env.NODE_ENV === 'production';
        const isCrossDomain = isProduction && process.env.FRONTEND_URL && 
          !process.env.FRONTEND_URL.includes('localhost');
        
        const frontendUrl = process.env.FRONTEND_URL || '';
        const isLocalFrontend = !frontendUrl || /(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(frontendUrl);
        const allowInsecureCookies = process.env.ALLOW_INSECURE_COOKIES === 'true';
        const shouldUseSecureCookies = isProduction && !isLocalFrontend && !allowInsecureCookies;
        
        res.clearCookie('pharmacy.sid', {
          httpOnly: true,
          secure: shouldUseSecureCookies,
          sameSite: isCrossDomain && shouldUseSecureCookies ? 'none' : 'lax',
          path: '/'
        });
        return res.json({ message: 'Logout successful' });
      });
    } else {
      return res.json({ message: 'Logout successful' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to logout' });
  }
});

// Redirection endpoint - all users go to the same dashboard
router.get('/redirect', auth, (req, res) => {
  return res.json({ redirectUrl: '/dashboard' });
});

router.get('/users', auth, async (req, res) => {
  try {
    const users = await listUsers();
    const sanitized = users.map(({ passwordHash, ...rest }) => rest);
    return res.json({ users: sanitized });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to list users' });
  }
});

module.exports = router;


