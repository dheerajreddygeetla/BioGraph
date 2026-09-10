const mongoose = require('mongoose');

const RelationshipSchema = new mongoose.Schema(
  {
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Entity',
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Entity',
      required: true,
    },
    relation: {
      type: String,
      required: true,
      enum: [
        'ASSOCIATED_WITH',
        'ENCODES',
        'INVOLVED_IN',
        'TARGETS',
        'TESTED_IN',
        'SUPPORTS',
        'INTERACTS_WITH',
      ],
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },
    evidence: [String],
    sourceDatabase: String,
  },
  {
    timestamps: true,
  }
);

RelationshipSchema.index({ sourceId: 1, targetId: 1, relation: 1 }, { unique: true });

module.exports = mongoose.model('Relationship', RelationshipSchema);