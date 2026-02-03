const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['admin', 'salesperson', 'storekeeper'], required: true },
    isActive: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String },
    ipAddress: { type: String },
    lastActivity: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Create TTL index for automatic cleanup of expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session = mongoose.model('Session', sessionSchema);

async function createSession({ sessionId, userId, role, userAgent, ipAddress, expiresAt }) {
  // Validate required fields with stricter checks
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
    throw new Error('Session ID is required and must be a non-empty string');
  }
  if (!userId) {
    throw new Error('User ID is required');
  }
  if (!role) {
    throw new Error('Role is required');
  }
  if (!expiresAt) {
    throw new Error('Expires date is required');
  }

  try {
    // Check for existing invalid sessions and clean them up first
    await Session.deleteMany({
      $or: [
        { sessionId: null },
        { sessionId: '' }
      ]
    });

    const session = await Session.create({
      sessionId,
      userId,
      role,
      userAgent,
      ipAddress,
      expiresAt
    });
    return session.toJSON();
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
}

async function getSession(sessionId) {
  const session = await Session.findOne({ 
    sessionId, 
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).populate('userId', 'name username role').exec();
  
  if (session) {
    // Update last activity
    await Session.findByIdAndUpdate(session._id, { lastActivity: new Date() });
  }
  
  return session ? session.toJSON() : null;
}

async function invalidateSession(sessionId) {
  return Session.findOneAndUpdate(
    { sessionId },
    { isActive: false },
    { new: true }
  ).exec();
}

async function invalidateAllUserSessions(userId) {
  return Session.updateMany(
    { userId, isActive: true },
    { isActive: false }
  ).exec();
}

async function cleanupExpiredSessions() {
  try {
    const result = await Session.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { isActive: false },
        { sessionId: null },
        { sessionId: '' },
        { sessionId: { $exists: false } }
      ]
    }).exec();
    
    return result.deletedCount || 0;
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    return 0;
  }
}

module.exports = {
  Session,
  createSession,
  getSession,
  invalidateSession,
  invalidateAllUserSessions,
  cleanupExpiredSessions
};
