const AuditLog = require('../models/AuditLog');

// Helper to get IP from request (handles proxies)
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || req.ip;
};

// Middleware to log actions
const auditLog = (action, resource = null) => {
  return async (req, res, next) => {
    // Capture the original send to log status code
    const originalSend = res.send;
    let statusCode = 200;

    res.send = function (body) {
      statusCode = res.statusCode;
      return originalSend.call(this, body);
    };

    // Wait for response to finish
    res.on('finish', async () => {
      try {
        const logEntry = {
          user: req.user?._id || null,
          action,
          resource: resource || req.originalUrl || req.url,
          method: req.method,
          ip: getClientIp(req),
          userAgent: req.headers['user-agent'] || '',
          details: req.body || {},
          statusCode: statusCode,
        };
        await AuditLog.create(logEntry);
      } catch (err) {
        console.error('Audit log error:', err.message);
      }
    });

    next();
  };
};

module.exports = auditLog;