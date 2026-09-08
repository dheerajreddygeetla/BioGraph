const mongoose = require('mongoose');

const ResearchSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    question: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      required: true,
    },
    citations: [String],
    confidence: Number,
    agentSteps: [
      {
        agent: String,
        status: String, // 'pending', 'running', 'completed', 'failed'
        output: mongoose.Schema.Types.Mixed,
        timestamp: Date,
      },
    ],
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Entity',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ResearchSession', ResearchSessionSchema);