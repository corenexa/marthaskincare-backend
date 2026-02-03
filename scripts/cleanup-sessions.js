const mongoose = require('mongoose');
require('dotenv').config();

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['admin', 'pharmacist', 'cashier'], required: true },
  isActive: { type: Boolean, default: true, index: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  userAgent: { type: String },
  ipAddress: { type: String },
  lastActivity: { type: Date, default: Date.now }
}, { timestamps: true });

const Session = mongoose.model('Session', sessionSchema);

async function cleanupSessions() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Clean up sessions with null sessionId or missing sessionId
    const result = await Session.deleteMany({
      $or: [
        { sessionId: null },
        { sessionId: { $exists: false } },
        { sessionId: '' }
      ]
    });

    console.log(`Cleaned up ${result.deletedCount} problematic sessions`);

    // Also clean up expired sessions
    const expiredResult = await Session.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { isActive: false }
      ]
    });

    console.log(`Cleaned up ${expiredResult.deletedCount} expired sessions`);

    console.log('Session cleanup completed successfully');
  } catch (error) {
    console.error('Error during session cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

cleanupSessions();
