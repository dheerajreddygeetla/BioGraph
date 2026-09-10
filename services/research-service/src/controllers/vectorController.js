const VectorService = require('../services/vectorService');

const searchVectors = async (req, res, next) => {
  try {
    const { query, limit = 5, filter } = req.body;
    if (!query) return res.status(400).json({ message: 'Query is required' });

    const results = await VectorService.hybridSearch(query, limit, filter);
    res.json({ query, count: results.length, results });
  } catch (error) {
    next(error);
  }
};

const getVectorStats = async (req, res, next) => {
  try {
    const stats = await VectorService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

module.exports = { searchVectors, getVectorStats };