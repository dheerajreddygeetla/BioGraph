const { researchQueue } = require('../config/queue');
const ResearchSession = require('../models/ResearchSession');

// @desc    Start research job (enqueue) – supports filters
// @route   POST /api/research/query
// @access  Private
const researchQuery = async (req, res, next) => {
  try {
    const { question, entityId, filters } = req.body;
    if (!question) {
      return res.status(400).json({ message: 'Question is required' });
    }

    const job = await researchQueue.add('research-query', {
      question,
      entityId,
      filters: filters || {},
    });

    res.status(202).json({
      jobId: job.id,
      message: 'Research job queued.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get job status (including agent steps)
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
      state,
      progress,
      result: state === 'completed' ? result : null,
      error: state === 'failed' ? job.failedReason : null,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Save a research session
// @route   POST /api/research/save
// @access  Private
const saveSession = async (req, res, next) => {
  try {
    const { question, answer, citations, confidence, agentSteps, entityId } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ message: 'Question and answer are required' });
    }

    const session = await ResearchSession.create({
      user: req.user._id,
      question,
      answer,
      citations: citations || [],
      confidence: confidence || 0.5,
      agentSteps: agentSteps || [],
      entityId: entityId || null,
    });

    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all saved sessions for the current user
// @route   GET /api/research/saved
// @access  Private
const getSavedSessions = async (req, res, next) => {
  try {
    const sessions = await ResearchSession.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('entityId', 'name type');
    res.json(sessions);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  researchQuery,
  getJobStatus,
  saveSession,
  getSavedSessions,
};