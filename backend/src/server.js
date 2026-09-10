const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { verifyConnectivity: verifyNeo4j } = require('./config/neo4j');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter, authLimiter, researchLimiter } = require('./middleware/rateLimiter');
const auditLog = require('./middleware/auditLogger');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json());

// General rate limiter for all requests (optional)
app.use(generalLimiter);

// Stricter limiter on auth routes
app.use('/api/auth', authLimiter);

// Research-specific limiter
app.use('/api/research', researchLimiter);

// Audit logging for sensitive actions
app.use('/api/auth/login', auditLog('LOGIN', '/api/auth/login'));
app.use('/api/auth/register', auditLog('LOGIN', '/api/auth/register'));
app.use('/api/research/query', auditLog('RESEARCH_QUERY', '/api/research/query'));
app.use('/api/research/save', auditLog('SAVE_SESSION', '/api/research/save'));

// ============================================================
// ROUTES
// ============================================================
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/entities', require('./routes/entityRoutes'));
app.use('/api/relationships', require('./routes/relationshipRoutes'));
app.use('/api/graph', require('./routes/graphRoutes'));
app.use('/api/research', require('./routes/researchRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/vector', require('./routes/vectorRoutes'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'BioGraph Backend is running',
    timestamp: new Date().toISOString(),
  });
});

// Error handler (must be last)
app.use(errorHandler);

// ============================================================
// STARTUP – Connect to all databases, then listen
// ============================================================
const PORT = process.env.PORT || 5002;

const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Verify Neo4j connectivity
    await verifyNeo4j();

    // 3. Initialize Qdrant collection + run schema migrations
    try {
      const SchemaMigration = require('./services/schemaMigration');
      await SchemaMigration.migrate();
    } catch (qdrantError) {
      console.warn('⚠️  Qdrant initialization failed (vector search may be unavailable):', qdrantError.message);
      // Do not crash the server – vector search is optional for basic functionality
    }

    // 4. Start listening
    app.listen(PORT, () => {
      console.log(`🚀 Backend server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app; // exported for testing