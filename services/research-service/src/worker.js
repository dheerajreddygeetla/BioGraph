require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./config/db');

mongoose.set('bufferTimeoutMS', 30000);

(async () => {
  try {
    await connectDB();
    console.log('✅ [research-service-worker] MongoDB connected');

    const { verifyConnectivity } = require('./config/neo4j');
    await verifyConnectivity();

    const { researchWorker } = require('./workers/researchWorker');
    console.log('🚀 Research worker started. Waiting for jobs...');

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