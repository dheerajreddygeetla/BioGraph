const express = require('express');
const { researchQuery, getJobStatus } = require('../controllers/researchController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/query', protect, researchQuery);
router.get('/status/:jobId', protect, getJobStatus);

module.exports = router;