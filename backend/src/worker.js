// Load environment variables from .env
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Increase global buffer timeout to prevent early timeouts
mongoose.set('bufferTimeoutMS', 30000);

// Immediately-invoked async function to connect and start worker
(async () => {
  try {
    // Wait for MongoDB connection
    await connectDB();
    console.log('✅ Worker connected to MongoDB.');

    // Now import and start the worker (it will begin processing jobs)
    const { researchWorker } = require('./workers/researchWorker');
    console.log('Research worker started. Listening for jobs...');

    // Optional: graceful shutdown
    process.on('SIGINT', () => {
      researchWorker.close().then(() => {
        console.log('Worker closed gracefully.');
        process.exit(0);
      });
    });
  } catch (err) {
    console.error('❌ Worker failed to start:', err.message);
    process.exit(1);
  }
})();