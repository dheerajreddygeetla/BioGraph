const express = require('express');
const {
  getGraph,
  searchGraph,
  findPathwayDrugs,
  getShortestPath,
} = require('../controllers/graphController');

const router = express.Router();

router.get('/search', searchGraph);
router.get('/pathway-drugs', findPathwayDrugs);
router.get('/shortest-path', getShortestPath);
router.get('/:identifier', getGraph);

module.exports = router;