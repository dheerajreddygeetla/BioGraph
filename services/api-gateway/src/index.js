require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { utils, metrics: sharedMetrics } = require('@biograph/shared');

const logger = utils.logger;
const app = express();

// ============================================================
// METRICS – initialize before anything else
// ============================================================
const metrics = sharedMetrics.createMetrics('api-gateway');
app.use(sharedMetrics.metricsMiddleware(metrics));

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

// ============================================================
// SERVICE REGISTRY
// ============================================================
const SERVICES = {
  monolith: process.env.MONOLITH_URL || 'http://localhost:5002',
  auth: process.env.AUTH_SERVICE_URL || null,
  entity: process.env.ENTITY_SERVICE_URL || null,
  research: process.env.RESEARCH_SERVICE_URL || null,
};

logger.info('Gateway service registry:', SERVICES);

// ============================================================
// TARGET RESOLVER
// ============================================================
function targetFor(path) {
  if (SERVICES.auth && path.startsWith('/api/auth')) {
    return { url: SERVICES.auth, name: 'auth-service' };
  }
  if (
    SERVICES.entity &&
    (path.startsWith('/api/entities') ||
      path.startsWith('/api/relationships') ||
      path.startsWith('/api/graph'))
  ) {
    return { url: SERVICES.entity, name: 'entity-service' };
  }
  if (
    SERVICES.research &&
    (path.startsWith('/api/research') || path.startsWith('/api/vector'))
  ) {
    return { url: SERVICES.research, name: 'research-service' };
  }
  return { url: SERVICES.monolith, name: 'monolith' };
}

// ============================================================
// PROXY
// ============================================================
app.use('/api', (req, res, next) => {
  const target = targetFor(req.originalUrl);
  logger.info(`→ ${req.method} ${req.originalUrl} → ${target.name}`);

  const proxy = createProxyMiddleware({
    target: target.url,
    changeOrigin: true,
    logLevel: 'warn',
    onError: (err, _req, res) => {
      logger.error(`Proxy error → ${target.name}:`, err.message);
      res.status(502).json({
        message: 'Service temporarily unavailable',
        service: target.name,
        error: err.message,
      });
    },
    onProxyReq: (proxyReq, req) => {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      proxyReq.setHeader('x-forwarded-for', ip);
    },
  });

  return proxy(req, res, next);
});

// ============================================================
// HEALTH & METRICS
// ============================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    upstreams: Object.entries(SERVICES)
      .filter(([, url]) => url)
      .map(([name, url]) => ({ name, url })),
  });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metrics.register.contentType);
  res.end(await metrics.register.metrics());
});

// ============================================================
// START
// ============================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`🚀 API Gateway running on port ${PORT}`);
  logger.info(`   Monolith → ${SERVICES.monolith}`);
  if (SERVICES.auth) logger.info(`   Auth     → ${SERVICES.auth}`);
  if (SERVICES.entity) logger.info(`   Entity   → ${SERVICES.entity}`);
  if (SERVICES.research) logger.info(`   Research → ${SERVICES.research}`);
});