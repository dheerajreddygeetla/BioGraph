const express = require('express');
const { searchVectors, getVectorStats } = require('../controllers/vectorController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/search', protect, searchVectors);
router.get('/stats', protect, authorize('admin'), getVectorStats);

module.exports = router;