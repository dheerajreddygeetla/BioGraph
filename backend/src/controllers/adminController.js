const AuditLog = require('../models/AuditLog');
const ResearchSession = require('../models/ResearchSession');
const User = require('../models/User');
const { researchQueue } = require('../config/queue');

// @desc    Get dashboard metrics
// @route   GET /api/admin/metrics
// @access  Private (admin only)
const getMetrics = async (req, res, next) => {
  try {
    // Total users
    const totalUsers = await User.countDocuments();

    // Total research sessions (across all users)
    const totalSessions = await ResearchSession.countDocuments();

    // Recent research queries (last 24h) from audit logs
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentQueries = await AuditLog.countDocuments({
      action: 'RESEARCH_QUERY',
      timestamp: { $gte: last24h },
    });

    // Error rate: count of 5xx responses in last 24h from audit logs
    const errors = await AuditLog.countDocuments({
      statusCode: { $gte: 500 },
      timestamp: { $gte: last24h },
    });

    // Queue depth: number of waiting jobs
    const waitingJobs = await researchQueue.getWaitingCount();
    const activeJobs = await researchQueue.getActiveCount();
    const completedJobs = await researchQueue.getCompletedCount();
    const failedJobs = await researchQueue.getFailedCount();

    // Average response time (we could compute from audit logs if we store response time, but we can skip for now)
    // We'll provide a placeholder.

    res.json({
      totalUsers,
      totalSessions,
      recentQueries,
      errorRate: {
        count: errors,
        percentage: recentQueries > 0 ? ((errors / recentQueries) * 100).toFixed(2) : 0,
      },
      queue: {
        waiting: waitingJobs,
        active: activeJobs,
        completed: completedJobs,
        failed: failedJobs,
        total: waitingJobs + activeJobs + completedJobs + failedJobs,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recent audit logs (for admin)
// @route   GET /api/admin/logs?limit=50
// @access  Private (admin only)
const getAuditLogs = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('user', 'name email');
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMetrics,
  getAuditLogs,
};