const { Queue } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
};

const researchQueue = new Queue('research', { connection });

module.exports = { researchQueue, connection };