require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const { verifyConnectivity: verifyNeo4j } = require('./config/neo4j');
const errorHandler = require('./middleware/errorHandler');
const { middleware, utils } = require('@biograph/shared');

const researchRoutes = require('./routes/researchRoutes');
const vectorRoutes = require('./routes/vectorRoutes');

const logger = utils.logger;
const { generalLimiter, researchLimiter } = middleware.rateLimiter;

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(generalLimiter);
app.use('/api/research', researchLimiter);

// Routes
app.use('/api/research', researchRoutes);
app.use('/api/vector', vectorRoutes);

// Health
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'research-service',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use(errorHandler);

// Start
const PORT = process.env.PORT || 5004;

const start = async () => {
  try {
    await connectDB();
    await verifyNeo4j();

    // Initialize Qdrant collection + migrations
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