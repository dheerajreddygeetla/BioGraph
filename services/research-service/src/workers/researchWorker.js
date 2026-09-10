const { Worker } = require('bullmq');
const { connection } = require('../config/queue');
const Neo4jService = require('../services/neo4jService');
const AgentService = require('../services/agentService');
const Entity = require('../models/Entity');

const researchWorker = new Worker(
  'research',
  async (job) => {
    const startTime = Date.now();
    console.log(`\n🔬 Processing job ${job.id}`);
    console.log(`   Question: "${job.data.question}"`);
    console.log(`   Entity:   ${job.data.entityId}`);
    console.log(`   Filters:  ${JSON.stringify(job.data.filters || {})}`);

    const { question, entityId, filters } = job.data;

    // --- metrics refs (may be undefined in tests) ---
    const metrics = global.__metrics;

    try {
      if (metrics) {
        metrics.activeResearchJobs.inc();
      }

      let entityName = null;
      if (entityId) {
        const entity = await Entity.findById(entityId).select('name type');
        if (entity) entityName = entity.name;
      }

      let graphContext = { nodes: [], edges: [] };
      if (entityId) {
        console.log(`   📊 Fetching graph context...`);
        graphContext = await Neo4jService.getGraph(entityId, 2);
        console.log(`   ✅ Graph: ${graphContext.nodes.length} nodes, ${graphContext.edges.length} edges`);
      }

      console.log(`   🤖 Running agent pipeline...`);

      // Wrap each agent step to measure duration
      const originalRunPipeline = AgentService.runPipeline.bind(AgentService);
      const { steps, finalOutput } = await originalRunPipeline(
        question,
        entityId,
        graphContext,
        filters || {}
      );

      // Record per-agent metrics
      if (metrics && Array.isArray(steps)) {
        for (const step of steps) {
          const agentName = step.agent || 'unknown';
          const status = step.status || 'unknown';
          metrics.agentStepTotal.inc({ agent: agentName, status });
        }
      }

      await job.updateProgress({ steps });

      // Record success
      if (metrics) {
        metrics.researchJobsTotal.inc({ status: 'completed' });
        metrics.researchJobDuration.observe((Date.now() - startTime) / 1000);
        metrics.activeResearchJobs.dec();
      }

      console.log(`   ✅ Job ${job.id} complete`);
      console.log(`   📊 Confidence: ${finalOutput.confidence}`);
      console.log(`   ⏱️  Duration: ${finalOutput.metadata?.duration_ms}ms\n`);

      return finalOutput;
    } catch (error) {
      if (metrics) {
        metrics.researchJobsTotal.inc({ status: 'failed' });
        metrics.researchJobDuration.observe((Date.now() - startTime) / 1000);
        metrics.activeResearchJobs.dec();
      }
      console.error(`   ❌ Job ${job.id} failed:`, error.message);
      throw error;
    }
  },
  { connection, concurrency: 5 }
);

researchWorker.on('completed', (job) => console.log(`✅ Job ${job.id} completed`));
researchWorker.on('failed', (job, err) => console.error(`❌ Job ${job?.id} failed:`, err.message));

module.exports = { researchWorker };