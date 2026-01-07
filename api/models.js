const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { getConfig } = require('./config');

const DATA_DIR = path.join(__dirname, '..', 'data');

function getModelsPath(userId) {
  return path.join(DATA_DIR, `models_${userId}.json`);
}

async function modelsHandler(req, res) {
  try {
    const userId = req.auth?.userId;
    // We allow fetching models without individual auth if system is configured?
    // Actually, user should still be signed in to see models via API
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const modelsPath = path.join(DATA_DIR, 'models_system.json');
    if (await fs.pathExists(modelsPath)) {
      const allModels = await fs.readJson(modelsPath);
      const enabledModels = allModels.filter(m => m.enabled !== false);
      return res.json({ data: enabledModels });
    }
    
    // Fallback to fetching directly from system config if file doesn't exist
    const config = await getConfig('system');
    if (config.apiBaseUrl && config.apiKey) {
      const url = `${config.apiBaseUrl.replace(/\/$/, '')}/models`;
      const response = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${config.apiKey}` }
      });
      return res.json(response.data);
    }

    res.json({ data: [] });
  } catch (error) {
    console.error('Models proxy error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
}

module.exports = modelsHandler;
