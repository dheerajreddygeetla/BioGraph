const express = require('express');
const { register, login, getMe, refresh } = require('../controllers/authController');
const { middleware } = require('@biograph/shared');

const router = express.Router();
const { authenticate } = middleware.auth;

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/refresh', authenticate, refresh);

module.exports = router;