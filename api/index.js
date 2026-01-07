const express = require('express');
const router = express.Router();
const chatHandler = require('./chat');
const modelsHandler = require('./models');

// Forward /v1/chat/completions
router.post('/chat/completions', chatHandler);

// Forward /v1/models
router.get('/models', modelsHandler);

module.exports = router;
