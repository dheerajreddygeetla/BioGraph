require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const { verifyConnectivity: verifyNeo4j } = require('./config/neo4j');
const errorHandler = require('./middleware/errorHandler');
const { middleware, utils, metrics: sharedMetrics } = require('@biograph/shared');

const entityRoutes = require('./routes/entityRoutes');
const relationshipRoutes = require('./routes/relationshipRoutes');
const graphRoutes = require('./routes/graphRoutes');

const logger = utils.logger;
const { generalLimiter } = middleware.rateLimiter;

const app = express();

// ============================================================
// METRICS
// ============================================================
const metrics = sharedMetrics.createMetrics('entity-service');
app.use(sharedMetrics.metricsMiddleware(metrics));

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(generalLimiter);

// ============================================================
// ROUTES
// ============================================================
app.use('/api/entities', entityRoutes);
app.use('/api/relationships', relationshipRoutes);
app.use('/api/graph', graphRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'entity-service',
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
const PORT = process.env.PORT || 5003;

const start = async () => {
  try {
    await connectDB();
    await verifyNeo4j();

    app.listen(PORT, () => {
      logger.info(`🚀 Entity Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start entity-service:', error.message);
    process.exit(1);
  }
};

start();