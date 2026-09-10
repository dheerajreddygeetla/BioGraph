require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { metrics: sharedMetrics, utils } = require('@biograph/shared');

mongoose.set('bufferTimeoutMS', 30000);

(async () => {
  try {
    await connectDB();
    console.log('✅ [research-service-worker] MongoDB connected');

    const { verifyConnectivity } = require('./config/neo4j');
    await verifyConnectivity();

    // Start a standalone metrics server on port 9101
    const metrics = sharedMetrics.createMetrics('research-worker');
    sharedMetrics.startMetricsServer(metrics, 9101);

    // Expose metrics object globally so the worker can update business counters
    global.__metrics = metrics;

    // Update queue gauges every 10 seconds
    setInterval(async () => {
      try {
        const { researchQueue } = require('./config/queue');
        const waiting = await researchQueue.getWaitingCount();
        const active = await researchQueue.getActiveCount();
        metrics.queueJobsWaiting.set(waiting);
        metrics.queueJobsActive.set(active);
      } catch (err) {
        // ignore transient errors
      }
    }, 10000);

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