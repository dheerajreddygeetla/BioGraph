const { researchQueue } = require('./src/config/queue');

(async () => {
  try {
    const job = await researchQueue.add('test', { question: 'test', entityId: 'dummy' });
    console.log('Job added successfully:', job.id);
    process.exit(0);
  } catch (err) {
    console.error('Error adding job:', err);
    process.exit(1);
  }
})();