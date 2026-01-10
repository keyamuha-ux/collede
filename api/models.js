const axios = require('axios');
const { getConfig, getSystemModels } = require('./config');

async function modelsHandler(req, res) {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const allModels = await getSystemModels();
    if (allModels && allModels.length > 0) {
      const enabledModels = allModels.filter(m => m.enabled !== false);
      return res.json({ data: enabledModels });
    }

    res.json({ data: [] });
  } catch (error) {
    console.error('Models proxy error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
}

module.exports = modelsHandler;

