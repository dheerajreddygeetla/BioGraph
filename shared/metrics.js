/**
 * Shared Prometheus metrics module for all BioGraph microservices.
 *
 * Usage:
 *   const { createMetrics, metricsMiddleware } = require('@biograph/shared').metrics;
 *   const metrics = createMetrics('my-service');
 *   app.use(metricsMiddleware(metrics));
 *   app.get('/metrics', async (req, res) => {
 *     res.set('Content-Type', metrics.register.contentType);
 *     res.end(await metrics.register.metrics());
 *   });
 */

const client = require('prom-client');

function createMetrics(serviceName) {
  const register = new client.Registry();

  // Attach `service` label to every metric
  register.setDefaultLabels({ service: serviceName });

  // Node.js default metrics (heap, GC, event loop, handles)
  client.collectDefaultMetrics({
    register,
    prefix: '',
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    eventLoopMonitoringPrecision: 10,
  });

  // ---- HTTP metrics ----
  const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
  });

  const httpRequestTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [register],
  });

  const httpRequestsInFlight = new client.Gauge({
    name: 'http_requests_in_flight',
    help: 'Number of HTTP requests currently being processed',
    registers: [register],
  });

  // ---- Business metrics (research pipeline) ----
  const researchJobsTotal = new client.Counter({
    name: 'research_jobs_total',
    help: 'Total number of research jobs processed',
    labelNames: ['status'],
    registers: [register],
  });

  const researchJobDuration = new client.Histogram({
    name: 'research_job_duration_seconds',
    help: 'Duration of research jobs in seconds',
    buckets: [1, 5, 10, 20, 30, 60, 120, 300, 600],
    registers: [register],
  });

  const activeResearchJobs = new client.Gauge({
    name: 'active_research_jobs',
    help: 'Number of research jobs currently being processed',
    registers: [register],
  });

  // ---- Agent step metrics ----
  const agentStepDuration = new client.Histogram({
    name: 'agent_step_duration_seconds',
    help: 'Duration of individual agent steps',
    labelNames: ['agent'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    registers: [register],
  });

  const agentStepTotal = new client.Counter({
    name: 'agent_step_total',
    help: 'Total number of agent steps executed',
    labelNames: ['agent', 'status'],
    registers: [register],
  });

  // ---- Queue metrics ----
  const queueJobsWaiting = new client.Gauge({
    name: 'queue_jobs_waiting',
    help: 'Number of jobs waiting in the queue',
    registers: [register],
  });

  const queueJobsActive = new client.Gauge({
    name: 'queue_jobs_active',
    help: 'Number of jobs currently being processed',
    registers: [register],
  });

  return {
    register,
    httpRequestDuration,
    httpRequestTotal,
    httpRequestsInFlight,
    researchJobsTotal,
    researchJobDuration,
    activeResearchJobs,
    agentStepDuration,
    agentStepTotal,
    queueJobsWaiting,
    queueJobsActive,
  };
}

/**
 * Express middleware that automatically tracks:
 *   - http_requests_in_flight (increment on start, decrement on finish)
 *   - http_request_duration_seconds (observe on finish)
 *   - http_requests_total (increment on finish)
 *
 * Skips the /metrics endpoint itself to avoid recursion.
 */
function metricsMiddleware(metrics) {
  return (req, res, next) => {
    // Skip metrics endpoint
    if (req.path === '/metrics') return next();

    metrics.httpRequestsInFlight.inc();

    const end = metrics.httpRequestDuration.startTimer();

    res.on('finish', () => {
      const labels = {
        method: req.method,
        route: req.route?.path || req.path || 'unknown',
        status_code: res.statusCode,
      };
      end(labels);
      metrics.httpRequestTotal.inc(labels);
      metrics.httpRequestsInFlight.dec();
    });

    next();
  };
}

/**
 * Standalone metrics server for processes that have no HTTP server
 * (e.g., BullMQ workers). Listens on a dedicated port and serves
 * only the /metrics endpoint.
 */
function startMetricsServer(metrics, port = 9101) {
  const http = require('http');
  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', metrics.register.contentType);
      res.end(await metrics.register.metrics());
    } else if (req.url === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'OK', service: process.env.SERVICE_NAME || 'worker' }));
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`📊 Metrics server listening on port ${port}`);
  });
  return server;
}

module.exports = { createMetrics, metricsMiddleware, startMetricsServer };