require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const { verifyConnectivity: verifyNeo4j } = require('./config/neo4j');
const errorHandler = require('./middleware/errorHandler');
const { middleware, utils, metrics: sharedMetrics } = require('@biograph/shared');

const researchRoutes = require('./routes/researchRoutes');
const vectorRoutes = require('./routes/vectorRoutes');

const logger = utils.logger;
const { generalLimiter, researchLimiter } = middleware.rateLimiter;

const app = express();

// ============================================================
// METRICS
// ============================================================
const metrics = sharedMetrics.createMetrics('research-service');
app.use(sharedMetrics.metricsMiddleware(metrics));

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(generalLimiter);
app.use('/api/research', researchLimiter);

// ============================================================
// ROUTES
// ============================================================
app.use('/api/research', researchRoutes);
app.use('/api/vector', vectorRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'research-service',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metrics.register.contentType);
  res.end(await metrics.register.metrics());
});

app.use(errorHandler);

// ============================================================
// START
// ============================================================
const PORT = process.env.PORT || 5004;

const start = async () => {
  try {
    await connectDB();
    await verifyNeo4j();

    try {
      const SchemaMigration = require('./services/schemaMigration');
      await SchemaMigration.migrate();
    } catch (err) {
      logger.warn('Qdrant init failed (vector search may be unavailable):', err.message);
    }

    app.listen(PORT, () => {
      logger.info(`🚀 Research Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start research-service:', error.message);
    process.exit(1);
  }
};

start();