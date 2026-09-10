const Neo4jService = require('../services/neo4jService');
const Entity = require('../models/Entity');

// @desc    Get graph around an entity (Neo4j-powered)
// @route   GET /api/graph/:identifier?depth=2
// @access  Public
const getGraph = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const depth = parseInt(req.query.depth) || 2;

    // Resolve identifier to entity ID
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
    let entityId = identifier;
    if (!isObjectId) {
      const entity = await Entity.findOne({
        name: { $regex: new RegExp(`^${identifier}$`, 'i') },
      });
      if (!entity) return res.status(404).json({ message: 'Entity not found' });
      entityId = entity._id.toString();
    }

    const graph = await Neo4jService.getGraph(entityId, depth);
    res.json(graph);
  } catch (error) {
    next(error);
  }
};

// @desc    Graph-oriented search
// @route   GET /api/graph/search?q=BRCA1
// @access  Public
const searchGraph = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: 'Query parameter "q" is required' });

    const entities = await Entity.find(
      { $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(10);

    // Deduplicate results by _id to prevent duplicates from name + alias matches
    const uniqueEntities = [];
    const seenIds = new Set();
    
    for (const entity of entities) {
      const idStr = entity._id.toString();
      if (!seenIds.has(idStr)) {
        seenIds.add(idStr);
        uniqueEntities.push(entity);
      }
    }

    res.json(uniqueEntities);
  } catch (error) {
    next(error);
  }
};

// @desc    Find drugs targeting proteins in a pathway
// @route   GET /api/graph/pathway-drugs?pathway=...
// @access  Public
const findPathwayDrugs = async (req, res, next) => {
  try {
    const { pathway } = req.query;
    if (!pathway) return res.status(400).json({ message: 'pathway query required' });

    const results = await Neo4jService.findDrugsForPathway(pathway);
    res.json(results);
  } catch (error) {
    next(error);
  }
};

// @desc    Shortest path between two entities
// @route   GET /api/graph/shortest-path?from=...&to=...
// @access  Public
const getShortestPath = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ message: 'from and to required' });

    // Resolve names to entity IDs if needed
    const fromIsObjectId = /^[0-9a-fA-F]{24}$/.test(from);
    const toIsObjectId = /^[0-9a-fA-F]{24}$/.test(to);
    
    let fromId = from;
    let toId = to;
    
    if (!fromIsObjectId) {
      const fromEntity = await Entity.findOne({
        name: { $regex: new RegExp(`^${from}$`, 'i') },
      });
      if (!fromEntity) return res.status(404).json({ message: 'Source entity not found' });
      fromId = fromEntity._id.toString();
    }
    
    if (!toIsObjectId) {
      const toEntity = await Entity.findOne({
        name: { $regex: new RegExp(`^${to}$`, 'i') },
      });
      if (!toEntity) return res.status(404).json({ message: 'Target entity not found' });
      toId = toEntity._id.toString();
    }

    const path = await Neo4jService.shortestPath(fromId, toId);
    if (!path) return res.status(404).json({ message: 'No path found' });
    res.json(path);
  } catch (error) {
    next(error);
  }
};

module.exports = { getGraph, searchGraph, findPathwayDrugs, getShortestPath };