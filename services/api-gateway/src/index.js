require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { utils } = require('@biograph/shared');

const logger = utils.logger;
const app = express();

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

// ============================================================
// SERVICE REGISTRY
// Each service is addressed by hostname. During migration,
// all traffic goes to the monolith. As services are extracted,
// update these URLs to point to the new services.
// ============================================================
const SERVICES = {
  // The monolith runs on 5001 (moved from 5000 to make room for gateway)
  monolith: process.env.MONOLITH_URL || 'http://localhost:5001',

  // Will be enabled in Phase 3b:
  auth: process.env.AUTH_SERVICE_URL || null,

  // Will be enabled in Phase 3c:
  entity: process.env.ENTITY_SERVICE_URL || null,

  // Will be enabled in Phase 3d:
  research: process.env.RESEARCH_SERVICE_URL || null,
};

logger.info('Gateway service registry:', SERVICES);

// ============================================================
// HELPER: pick target based on route
// ============================================================
function targetFor(path) {
  // Auth service
  if (SERVICES.auth && path.startsWith('/api/auth')) {
    return { url: SERVICES.auth, name: 'auth-service' };
  }
  // Entity service (entities, relationships, graph)
  if (
    SERVICES.entity &&
    (path.startsWith('/api/entities') ||
      path.startsWith('/api/relationships') ||
      path.startsWith('/api/graph'))
  ) {
    return { url: SERVICES.entity, name: 'entity-service' };
  }
  // Research service
  if (
    SERVICES.research &&
    (path.startsWith('/api/research') || path.startsWith('/api/vector'))
  ) {
    return { url: SERVICES.research, name: 'research-service' };
  }
  // Default: monolith
  return { url: SERVICES.monolith, name: 'monolith' };
}

// ============================================================
// PROXY MIDDLEWARE – built dynamically per request
// ============================================================
app.use('/api', (req, res, next) => {
  const target = targetFor(req.originalUrl);
  logger.info(`→ ${req.method} ${req.originalUrl} → ${target.name} (${target.url})`);

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
      // Forward user IP for audit logging downstream
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      proxyReq.setHeader('x-forwarded-for', ip);
    },
  });

  return proxy(req, res, next);
});

// ============================================================
// HEALTH CHECK
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