const Relationship = require('../models/Relationship');

// @desc    Get all relationships (with optional filters)
// @route   GET /api/relationships
// @access  Public
const getRelationships = async (req, res, next) => {
  try {
    const { sourceId, targetId, relation } = req.query;
    let filter = {};
    if (sourceId) filter.sourceId = sourceId;
    if (targetId) filter.targetId = targetId;
    if (relation) filter.relation = relation;

    const relationships = await Relationship.find(filter)
      .populate('sourceId', 'name type')
      .populate('targetId', 'name type');

    res.json(relationships);
  } catch (error) {
    next(error);
  }
};

module.exports = { getRelationships };