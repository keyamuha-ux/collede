const express = require('express');
const router = express.Router();
const { getConfig, saveConfig } = require('./config');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { clerkClient } = require('@clerk/clerk-sdk-node');

const DATA_DIR = path.join(__dirname, '..', 'data');

function getModelsPath(userId) {
  if (userId === 'system') {
    return path.join(DATA_DIR, 'models_system.json');
  }
  return path.join(DATA_DIR, `models_${userId}.json`);
}

// Admin check middleware
async function isAdmin(req, res, next) {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
    
    if (email === process.env.ADMIN_EMAIL) {
      req.isAdmin = true;
      return next();
    }
    res.status(403).json({ error: 'Forbidden: Admin access only' });
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get current config (Admin manages system config)
router.get('/config', isAdmin, async (req, res) => {
  const config = await getConfig('system');
  const maskedConfig = {
    ...config,
    apiKey: config.apiKey ? `sk-...${config.apiKey.slice(-4)}` : ''
  };
  res.json(maskedConfig);
});

// Save config (Admin manages system config)
router.post('/config', isAdmin, async (req, res) => {
  const { apiBaseUrl, apiKey } = req.body;
  
  const updateData = { apiBaseUrl };
  if (apiKey && !apiKey.startsWith('sk-...')) {
    updateData.apiKey = apiKey;
  }

  const success = await saveConfig('system', updateData);
  if (success) {
    res.json({ message: 'System configuration saved successfully' });
  } else {
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// Fetch models from provider (System wide)
router.post('/fetch-models', isAdmin, async (req, res) => {
  try {
    const config = await getConfig('system');
    if (!config.apiBaseUrl || !config.apiKey) {
      return res.status(400).json({ error: 'API not configured' });
    }

    const url = `${config.apiBaseUrl.replace(/\/$/, '')}/models`;
    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${config.apiKey}` }
    });

    const models = response.data.data || response.data;
    const modelsPath = getModelsPath('system');
    
    let existingModels = [];
    if (await fs.pathExists(modelsPath)) {
      existingModels = await fs.readJson(modelsPath);
    }

    const updatedModels = models.map(model => {
      const existing = existingModels.find(m => m.id === model.id);
      return {
        id: model.id,
        name: model.name || model.id,
        created: model.created,
        owned_by: model.owned_by,
        enabled: existing ? existing.enabled : true
      };
    });

    await fs.writeJson(modelsPath, updatedModels, { spaces: 2 });
    res.json(updatedModels);
  } catch (error) {
    console.error('Error fetching models:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch models from provider' });
  }
});

// Get system models
router.get('/models', async (req, res) => {
  const modelsPath = getModelsPath('system');
  if (await fs.pathExists(modelsPath)) {
    const models = await fs.readJson(modelsPath);
    return res.json(models);
  }
  res.json([]);
});

// Toggle model status (Admin only)
router.post('/toggle-model', isAdmin, async (req, res) => {
  const { modelId, enabled } = req.body;
  const modelsPath = getModelsPath('system');
  try {
    if (await fs.pathExists(modelsPath)) {
      const models = await fs.readJson(modelsPath);
      const updatedModels = models.map(m => 
        m.id === modelId ? { ...m, enabled } : m
      );
      await fs.writeJson(modelsPath, updatedModels, { spaces: 2 });
      res.json({ message: 'Model status updated' });
    } else {
      res.status(404).json({ error: 'Models not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update model status' });
  }
});

module.exports = router;
