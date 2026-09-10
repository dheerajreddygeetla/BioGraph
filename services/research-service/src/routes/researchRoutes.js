const express = require('express');
const {
  researchQuery,
  getJobStatus,
  saveSession,
  getSavedSessions,
} = require('../controllers/researchController');
const { middleware } = require('@biograph/shared');

const router = express.Router();
const { authenticate } = middleware.auth;

router.post('/query', authenticate, researchQuery);
router.get('/status/:jobId', authenticate, getJobStatus);
router.post('/save', authenticate, saveSession);
router.get('/saved', authenticate, getSavedSessions);

module.exports = router;