module.exports = {
  middleware: {
    auth: require('./middleware/auth'),
    rateLimiter: require('./middleware/rateLimiter'),
  },
  utils: {
    logger: require('./utils/logger'),
  },
  metrics: require('./metrics'),
};