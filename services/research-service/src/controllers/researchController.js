const { researchQueue } = require('../config/queue');
const ResearchSession = require('../models/ResearchSession');

const researchQuery = async (req, res, next) => {
  try {
    const { question, entityId, filters } = req.body;
    if (!question) return res.status(400).json({ message: 'Question is required' });

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
    console.error('Queue error:', error.message);
    next(error);
  }
};

const getJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await researchQueue.getJob(jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    const state = await job.getState();
    res.json({
      jobId,
      state,
      progress: job.progress,
      result: state === 'completed' ? job.returnvalue : null,
      error: state === 'failed' ? job.failedReason : null,
    });
  } catch (error) {
    next(error);
  }
};

const saveSession = async (req, res, next) => {
  try {
    const { question, answer, citations, confidence, agentSteps, entityId } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ message: 'Question and answer are required' });
    }

    const session = await ResearchSession.create({
      user: req.user.id,
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

const getSavedSessions = async (req, res, next) => {
  try {
    const sessions = await ResearchSession.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .populate('entityId', 'name type');
    res.json(sessions);
  } catch (error) {
    next(error);
  }
};

module.exports = { researchQuery, getJobStatus, saveSession, getSavedSessions };