const express = require('express');
const {
  getEntities,
  getEntityById,
  getEntityRelationships,
} = require('../controllers/entityController');

const router = express.Router();

router.get('/', getEntities);
router.get('/:id', getEntityById);
router.get('/:id/relationships', getEntityRelationships);

module.exports = router;