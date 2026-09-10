const mongoose = require('mongoose');

const PaperSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      index: true,
    },
    authors: [String],
    publicationDate: Date,
    journal: String,
    doi: {
      type: String,
      unique: true,
      sparse: true, // allows multiple docs with no DOI
      trim: true,
    },
    abstract: String,
    fullText: String,
  },
  {
    timestamps: true,
  }
);

// Compound index for full-text search on title + abstract
PaperSchema.index({ title: 'text', abstract: 'text' });

module.exports = mongoose.model('Paper', PaperSchema);