const rateLimit = require('express-rate-limit');

// General limiter – applies to all routes (optional)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for authentication (login, register, refresh)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter for expensive AI/research endpoints
const researchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // per IP per hour
  message: { message: 'Research query limit reached. Please wait before making more requests.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Optionally skip for admin users? We'll check in controller.
    return false;
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  researchLimiter,
};