const { Queue } = require('bullmq');

// Redis connection options
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
};

// Create a queue for research jobs
const researchQueue = new Queue('research', { connection });

module.exports = { researchQueue, connection };