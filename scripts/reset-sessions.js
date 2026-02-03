const mongoose = require('mongoose');
require('dotenv').config();

async function resetSessions() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Drop the entire sessions collection to start fresh
    await db.collection('sessions').drop().catch(() => {
      console.log('Sessions collection did not exist');
    });
    
    console.log('✓ Dropped sessions collection');
    
    // Also drop express sessions
    await db.collection('express-sessions').drop().catch(() => {
      console.log('Express-sessions collection did not exist');
    });
    
    console.log('✓ Dropped express-sessions collection');
    
    console.log('\nSession reset complete! Please restart your server.');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error resetting sessions:', error);
    process.exit(1);
  }
}

resetSessions();

