const Neo4jService = require('../services/neo4jService');

// @desc    Get graph around an entity (Neo4j-powered)
// @route   GET /api/graph/:identifier?depth=2
// @access  Public
const getGraph = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const depth = parseInt(req.query.depth) || 2;

    const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
    let entityId = identifier;
    if (!isObjectId) {
      const entity = await Neo4jService.findEntityByName(identifier);
      if (!entity) return res.status(404).json({ message: 'Entity not found' });
      entityId = entity.id;
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

    const entities = await Neo4jService.searchEntities(q);
    res.json(entities);
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
      const fromEntity = await Neo4jService.findEntityByName(from);
      if (!fromEntity) return res.status(404).json({ message: 'Source entity not found' });
      fromId = fromEntity.id;
    }
    
    if (!toIsObjectId) {
      const toEntity = await Neo4jService.findEntityByName(to);
      if (!toEntity) return res.status(404).json({ message: 'Target entity not found' });
      toId = toEntity.id;
    }

    const path = await Neo4jService.shortestPath(fromId, toId);
    if (!path) return res.status(404).json({ message: 'No path found' });
    res.json(path);
  } catch (error) {
    next(error);
  }
};

module.exports = { getGraph, searchGraph, findPathwayDrugs, getShortestPath };