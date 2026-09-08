const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter, authLimiter, researchLimiter } = require('./middleware/rateLimiter');
const auditLog = require('./middleware/auditLogger');

dotenv.config();
connectDB();

const app = express();

// CORS
app.use(cors());

// Body parser
app.use(express.json());

// Apply general rate limiter to all routes (optional)
app.use(generalLimiter);

// Auth routes – stricter limiter
app.use('/api/auth', authLimiter);

// Research routes – research-specific limiter
app.use('/api/research', researchLimiter);

// Routes with audit logging for sensitive actions
app.use('/api/auth/login', auditLog('LOGIN'));
app.use('/api/auth/register', auditLog('LOGIN'));
app.use('/api/auth/logout', auditLog('LOGOUT')); // if we implement logout
app.use('/api/research/query', auditLog('RESEARCH_QUERY', '/api/research/query'));
app.use('/api/research/save', auditLog('SAVE_SESSION', '/api/research/save'));

// Public routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/entities', require('./routes/entityRoutes'));
app.use('/api/relationships', require('./routes/relationshipRoutes'));
app.use('/api/graph', require('./routes/graphRoutes'));

// Research routes (protected, with limiter)
app.use('/api/research', require('./routes/researchRoutes'));

// Admin routes (protected, with limiter and authorization)
app.use('/api/admin', require('./routes/adminRoutes'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'BioGraph Backend is running' });
});

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});