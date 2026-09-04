const Entity = require('../models/Entity');
const Relationship = require('../models/Relationship');

// @desc    Get all entities (with filter)
// @route   GET /api/entities
// @access  Public
const getEntities = async (req, res, next) => {
  try {
    const { type, q, limit = 20 } = req.query;

    let filter = {};
    if (type) filter.type = type;

    let query = Entity.find(filter);

    if (q) {
      // Text search on name and aliases
      query = Entity.find({ $text: { $search: q } }, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } });
    }

    const entities = await query.limit(parseInt(limit));
    res.json(entities);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single entity by ID
// @route   GET /api/entities/:id
// @access  Public
const getEntityById = async (req, res, next) => {
  try {
    const entity = await Entity.findById(req.params.id);
    if (!entity) {
      return res.status(404).json({ message: 'Entity not found' });
    }
    res.json(entity);
  } catch (error) {
    next(error);
  }
};

// @desc    Get relationships for an entity
// @route   GET /api/entities/:id/relationships
// @access  Public
const getEntityRelationships = async (req, res, next) => {
  try {
    const entityId = req.params.id;

    // Find all relationships where entity is source or target
    const relations = await Relationship.find({
      $or: [{ sourceId: entityId }, { targetId: entityId }],
    })
      .populate('sourceId', 'name type')
      .populate('targetId', 'name type');

    res.json(relations);
  } catch (error) {
    next(error);
  }
};

module.exports = { getEntities, getEntityById, getEntityRelationships };