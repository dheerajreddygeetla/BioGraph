const express = require('express');
const { searchVectors, getVectorStats } = require('../controllers/vectorController');
const { middleware } = require('@biograph/shared');

const router = express.Router();
const { authenticate, authorize } = middleware.auth;

router.post('/search', authenticate, searchVectors);
router.get('/stats', authenticate, authorize('admin'), getVectorStats);

module.exports = router;