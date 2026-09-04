const mongoose = require('mongoose');

const EntitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['GENE', 'DISEASE', 'PROTEIN', 'DRUG', 'PATHWAY', 'MUTATION', 'CLINICAL_TRIAL'],
      required: true,
    },
    name: {
      type: String,
      required: true,
      index: true,
    },
    aliases: [String],
    description: String,
    properties: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    externalIds: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast search
EntitySchema.index({ name: 'text', aliases: 'text' });

module.exports = mongoose.model('Entity', EntitySchema);