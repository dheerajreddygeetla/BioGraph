const { Worker } = require('bullmq');
const { connection } = require('../config/queue');
const Neo4jService = require('../services/neo4jService');
const AgentService = require('../services/agentService');
const Entity = require('../models/Entity');

const researchWorker = new Worker(
  'research',
  async (job) => {
    console.log(`\n🔬 Processing job ${job.id}`);
    console.log(`   Question: "${job.data.question}"`);
    console.log(`   Entity:   ${job.data.entityId}`);
    console.log(`   Filters:  ${JSON.stringify(job.data.filters || {})}`);

    const { question, entityId, filters } = job.data;

    try {
      // 1. Resolve entity name (for logging)
      let entityName = null;
      if (entityId) {
        const entity = await Entity.findById(entityId).select('name type');
        if (entity) entityName = entity.name;
      }

      // 2. Fetch graph context from Neo4j
      let graphContext = { nodes: [], edges: [] };
      if (entityId) {
        console.log(`   📊 Fetching graph context (depth 2)...`);
        graphContext = await Neo4jService.getGraph(entityId, 2);
        console.log(`   ✅ Graph: ${graphContext.nodes.length} nodes, ${graphContext.edges.length} edges`);
      }

      // 3. Run the multi-agent pipeline (with filters)
      console.log(`   🤖 Running agent pipeline...`);
      const { steps, finalOutput } = await AgentService.runPipeline(
        question,
        entityId,
        graphContext,
        filters || {}
      );

      // 4. Update job progress with steps
      await job.updateProgress({ steps });

      // 5. Log summary
      console.log(`   ✅ Job ${job.id} complete`);
      console.log(`   📝 Answer: ${finalOutput.answer.slice(0, 120)}...`);
      console.log(`   📊 Confidence: ${finalOutput.confidence}`);
      console.log(`   ⏱️  Duration: ${finalOutput.metadata?.duration_ms}ms\n`);

      return finalOutput;
    } catch (error) {
      console.error(`   ❌ Job ${job.id} failed:`, error.message);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

researchWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

researchWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

console.log('🚀 Research worker started. Waiting for jobs...');

module.exports = { researchWorker };