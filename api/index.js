const express = require('express');
const router = express.Router();
const chatHandler = require('./chat');
const modelsHandler = require('./models');
const { authenticate } = require('./auth');

// Forward /v1/chat/completions with dual-auth support
router.post('/chat/completions', authenticate, chatHandler);

// Forward /v1/models with dual-auth support
router.get('/models', authenticate, modelsHandler);

module.exports = router;
