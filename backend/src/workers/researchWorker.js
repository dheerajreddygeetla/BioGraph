const { Worker } = require('bullmq');
const axios = require('axios');
const { connection } = require('../config/queue');
const { getGraphContext } = require('../services/graphService');  // <-- import

const researchWorker = new Worker(
  'research',
  async (job) => {
    console.log(`Processing job ${job.id} with data:`, job.data);
    const { question, entityId } = job.data;

    try {
      // Fetch graph context using the shared service
      let context = { nodes: [], edges: [] };
      if (entityId) {
        const graphData = await getGraphContext(entityId, 2);
        if (graphData) {
          context = graphData;
        }
      }

      // Call Python AI service
      const aiResponse = await axios.post('http://localhost:8000/generate', {
        question,
        context,
      });

      return {
        answer: aiResponse.data.answer,
        citations: aiResponse.data.citations || [],
        confidence: aiResponse.data.confidence || 0.5,
      };
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