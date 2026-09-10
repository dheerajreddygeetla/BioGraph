require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { middleware, utils, metrics: sharedMetrics } = require('@biograph/shared');

const authRoutes = require('./routes/authRoutes');

const logger = utils.logger;
const { generalLimiter, authLimiter } = middleware.rateLimiter;

const app = express();

// ============================================================
// METRICS
// ============================================================
const metrics = sharedMetrics.createMetrics('auth-service');
app.use(sharedMetrics.metricsMiddleware(metrics));

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ============================================================
// ROUTES
// ============================================================
app.use('/api/auth', authRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'auth-service',
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
const PORT = process.env.PORT || 5001;

const start = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      logger.info(`🚀 Auth Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start auth-service:', error.message);
    process.exit(1);
  }
};

start();