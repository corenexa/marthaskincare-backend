const { cleanupExpiredSessions } = require('../models/session');

// Clean up expired sessions every hour
function startSessionCleanup() {
  const cleanupInterval = 60 * 60 * 1000; // 1 hour in milliseconds
  
  const cleanup = async () => {
    try {
      const result = await cleanupExpiredSessions();
      console.log(`Session cleanup: Removed ${result.deletedCount} expired sessions`);
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  };

  // Run cleanup immediately on start
  cleanup();
  
  // Then run every hour
  setInterval(cleanup, cleanupInterval);
}

module.exports = { startSessionCleanup };
