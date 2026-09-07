const { researchQueue } = require('../config/queue');
const { getGraphContext } = require('../services/graphService');

// @desc    Start research job (enqueue)
// @route   POST /api/research/query
// @access  Private
const researchQuery = async (req, res, next) => {
  try {
    const { question, entityId } = req.body;
    if (!question) {
      return res.status(400).json({ message: 'Question is required' });
    }

    // Add job to queue
    const job = await researchQueue.add('research-query', {
      question,
      entityId,
    });

    // Return job ID immediately
    res.status(202).json({
      jobId: job.id,
      message: 'Research job queued. Check status via /api/research/status/:jobId',
    });
  } catch (error) {
    console.error('Queue error:', error.message);
    next(error);
  }
};

// @desc    Get job status and result
// @route   GET /api/research/status/:jobId
// @access  Private
const getJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await researchQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const state = await job.getState();
    const result = job.returnvalue;
    const progress = job.progress;

    res.json({
      jobId,
      state, // 'waiting', 'active', 'completed', 'failed'
      progress,
      result: state === 'completed' ? result : null,
      error: state === 'failed' ? job.failedReason : null,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { researchQuery, getJobStatus };