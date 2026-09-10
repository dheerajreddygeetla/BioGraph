require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const { verifyConnectivity: verifyNeo4j } = require('./config/neo4j');
const errorHandler = require('./middleware/errorHandler');
const { middleware, utils } = require('@biograph/shared');

const entityRoutes = require('./routes/entityRoutes');
const relationshipRoutes = require('./routes/relationshipRoutes');
const graphRoutes = require('./routes/graphRoutes');

const logger = utils.logger;
const { generalLimiter } = middleware.rateLimiter;

const app = express();

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

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'entity-service',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Error handler (last)
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