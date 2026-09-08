const express = require('express');
const {
  researchQuery,
  getJobStatus,
  saveSession,
  getSavedSessions,
} = require('../controllers/researchController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/query', protect, researchQuery);
router.get('/status/:jobId', protect, getJobStatus);
router.post('/save', protect, saveSession);
router.get('/saved', protect, getSavedSessions);

module.exports = router;