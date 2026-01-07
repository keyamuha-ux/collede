const axios = require('axios');
const { getConfig } = require('./config');
const { checkAndIncrementUsage } = require('./usage');

async function chatHandler(req, res) {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
    }

    // Check RPD Limit (13,000)
    const usage = await checkAndIncrementUsage(userId);
    if (!usage.allowed) {
      return res.status(429).json({
        error: {
          message: `Rate limit exceeded. Your daily limit is ${usage.limit} requests.`,
          type: 'rate_limit_error',
          code: 'daily_limit_reached'
        }
      });
    }

    // Use system config set by admin
    const config = await getConfig('system');
    if (!config.apiBaseUrl || !config.apiKey) {
      return res.status(503).json({ error: 'API Gateway is not yet configured by the administrator.' });
    }

    const { apiBaseUrl, apiKey } = config;
    const url = `${apiBaseUrl.replace(/\/$/, '')}/chat/completions`;

    // Forward the request with the user ID for abuse monitoring if supported by the provider
    const requestData = {
      ...req.body,
      user: userId // OpenAI standard for end-user tracking
    };

    const response = await axios.post(url, requestData, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      responseType: req.body.stream ? 'stream' : 'json'
    });

    if (req.body.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      response.data.pipe(res);
    } else {
      res.json(response.data);
    }
  } catch (error) {
    console.error('Chat proxy error:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data || { error: 'Failed to connect to the API provider' };
    res.status(status).json(message);
  }
}

module.exports = chatHandler;
