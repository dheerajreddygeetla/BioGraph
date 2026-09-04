const express = require('express');
const { getRelationships } = require('../controllers/relationshipController');

const router = express.Router();

router.get('/', getRelationships);

module.exports = router;