const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    action: {
      type: String,
      required: true,
      enum: ['LOGIN', 'LOGOUT', 'RESEARCH_QUERY', 'SAVE_SESSION', 'ADMIN_ACTION', 'RATE_LIMIT_EXCEEDED'],
    },
    resource: {
      type: String, // e.g., '/api/research/query', '/api/auth/login'
    },
    method: String,
    ip: String,
    userAgent: String,
    details: mongoose.Schema.Types.Mixed, // additional info (e.g., query, error)
    statusCode: Number,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast queries
AuditLogSchema.index({ user: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);