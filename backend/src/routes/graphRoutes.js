const express = require('express');
const { getGraph, searchGraph } = require('../controllers/graphController');

const router = express.Router();

router.get('/search', searchGraph);
router.get('/:identifier', getGraph);

module.exports = router;