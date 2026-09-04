const mongoose = require('mongoose');

const PaperSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    authors: [String],
    publicationDate: Date,
    journal: String,
    doi: {
      type: String,
      unique: true,
      sparse: true,
    },
    abstract: String,
    // We'll add chunk references later
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Paper', PaperSchema);