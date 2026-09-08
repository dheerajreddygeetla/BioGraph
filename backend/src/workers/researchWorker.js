const { Worker } = require('bullmq');
const { connection } = require('../config/queue');
const { getGraphContext } = require('../services/graphService');
const AgentService = require('../services/agentService');

const researchWorker = new Worker(
  'research',
  async (job) => {
    console.log(`Processing job ${job.id} with data:`, job.data);
    const { question, entityId } = job.data;

    try {
      // Step 1: Fetch graph context
      let context = { nodes: [], edges: [] };
      if (entityId) {
        const graphData = await getGraphContext(entityId, 2);
        if (graphData) context = graphData;
      }

      // Step 2: Run agent pipeline
      const { steps, finalOutput } = await AgentService.runPipeline(question, entityId, context);

      // Store steps in job progress (so frontend can show them)
      await job.updateProgress({ steps });

      // Return final result
      return finalOutput;
    } catch (error) {
      console.error('Worker error:', error.message);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

researchWorker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed with result:`, result);
});

researchWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error:`, err);
});

module.exports = { researchWorker };