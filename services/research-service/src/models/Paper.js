const mongoose = require('mongoose');

const PaperSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, index: true },
    authors: [String],
    publicationDate: Date,
    journal: String,
    doi: { type: String, unique: true, sparse: true, trim: true },
    abstract: String,
    fullText: String,
  },
  { timestamps: true }
);

PaperSchema.index({ title: 'text', abstract: 'text' });

module.exports = mongoose.model('Paper', PaperSchema);