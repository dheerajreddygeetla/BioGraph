const Entity = require('../models/Entity');
const Relationship = require('../models/Relationship');

// Helper: get entity by ID or name
const getEntity = async (identifier) => {
  // Check if it's a valid ObjectId
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
  let entity;
  if (isObjectId) {
    entity = await Entity.findById(identifier);
  } else {
    // Search by name (case-insensitive)
    entity = await Entity.findOne({ name: { $regex: new RegExp(`^${identifier}$`, 'i') } });
  }
  return entity;
};

// @desc    Get graph around an entity up to given depth
// @route   GET /api/graph/:identifier?depth=2
// @access  Public
const getGraph = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const depth = parseInt(req.query.depth) || 2;

    const root = await getEntity(identifier);
    if (!root) {
      return res.status(404).json({ message: 'Entity not found' });
    }

    // BFS to collect nodes and edges up to depth
    const visited = new Set();
    const nodes = [];
    const edges = [];
    const queue = [{ entity: root, currentDepth: 0 }];
    visited.add(root._id.toString());

    // Add root node
    nodes.push({
      id: root._id.toString(),
      type: root.type,
      name: root.name,
      description: root.description || '',
      data: { label: root.name, entity: root },
    });

    while (queue.length > 0) {
      const { entity, currentDepth } = queue.shift();
      if (currentDepth >= depth) continue;

      // Find relationships where this entity is source or target
      const relations = await Relationship.find({
        $or: [{ sourceId: entity._id }, { targetId: entity._id }],
      }).populate('sourceId targetId');

      for (const rel of relations) {
        // Determine the neighbour
        let neighbour;
        if (rel.sourceId._id.toString() === entity._id.toString()) {
          neighbour = rel.targetId;
        } else {
          neighbour = rel.sourceId;
        }
        const neighbourId = neighbour._id.toString();

        // Add neighbour node if not visited
        if (!visited.has(neighbourId)) {
          visited.add(neighbourId);
          nodes.push({
            id: neighbourId,
            type: neighbour.type,
            name: neighbour.name,
            description: neighbour.description || '',
            data: { label: neighbour.name, entity: neighbour },
          });
          // Enqueue for further expansion
          queue.push({ entity: neighbour, currentDepth: currentDepth + 1 });
        }

        // Add edge
        edges.push({
          id: `${rel._id}`,
          source: rel.sourceId._id.toString(),
          target: rel.targetId._id.toString(),
          label: rel.relation,
          data: { relation: rel.relation, confidence: rel.confidence, evidence: rel.evidence },
        });
      }
    }

    res.json({ nodes, edges });
  } catch (error) {
    next(error);
  }
};

// @desc    Search entities by name or alias (graph-oriented)
// @route   GET /api/graph/search?q=BRCA1
// @access  Public
const searchGraph = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ message: 'Query parameter "q" is required' });
    }

    // Use text search on Entity model
    const entities = await Entity.find(
      { $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(10);

    res.json(entities);
  } catch (error) {
    next(error);
  }
};

module.exports = { getGraph, searchGraph };