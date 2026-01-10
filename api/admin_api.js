const express = require('express');
const router = express.Router();
const { getConfig, saveConfig, getSystemModels, saveSystemModels } = require('./config');
const axios = require('axios');
const { clerkClient } = require('@clerk/clerk-sdk-node');

// Admin check middleware
async function isAdmin(req, res, next) {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
    
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    
    if (email && adminEmails.includes(email.toLowerCase())) {
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
  const providers = (config.providers || []).map(p => ({
    ...p,
    apiKey: p.apiKey ? `sk-...${p.apiKey.slice(-4)}` : ''
  }));
  res.json({ providers });
});

// Helper to normalize API Base URL
function normalizeBaseUrl(url) {
  if (!url) return '';
  let normalized = url.trim().replace(/\/$/, '');
  
  // Strip common subpaths that people might paste in
  const subpathsToStrip = [
    '/chat/completions',
    '/completions',
    '/chat',
    '/embeddings',
    '/models'
  ];
  
  for (const subpath of subpathsToStrip) {
    if (normalized.endsWith(subpath)) {
      normalized = normalized.slice(0, -subpath.length);
    }
  }
  
  // Ensure it ends with /v1 if it's an OpenAI-like API and doesn't already have it
  // But only if it's not a root domain like api.openai.com
  if (!normalized.includes('/v1') && (normalized.includes('openai') || normalized.includes('localhost') || normalized.includes('127.0.0.1'))) {
    // Check if it's a base domain
    const parts = normalized.split('/');
    if (parts.length <= 3) { // http://domain.com
      normalized = `${normalized}/v1`;
    }
  }

  return normalized.replace(/\/$/, '');
}

// Add a new provider
router.post('/providers/add', isAdmin, async (req, res) => {
  let { name, apiBaseUrl, apiKey } = req.body;
  if (!name || !apiBaseUrl || !apiKey) {
    return res.status(400).json({ error: 'Missing provider details' });
  }

  apiBaseUrl = normalizeBaseUrl(apiBaseUrl);

  try {
    const config = await getConfig('system');
    const providers = config.providers || [];
    
    const newProvider = {
      id: Date.now().toString(),
      name,
      apiBaseUrl,
      apiKey
    };

    providers.push(newProvider);
    await saveConfig('system', { providers });
    
    // Automatically fetch models for the new provider
    try {
      await fetchModelsFromProvider(newProvider);
    } catch (fetchError) {
      console.warn(`Provider added but failed to fetch models: ${fetchError.message}`);
      // We don't want to fail the whole request if only the model fetch fails
      return res.json({ 
        message: 'Provider added, but model sync failed. You can sync manually later.', 
        warning: fetchError.message,
        provider: { ...newProvider, apiKey: 'sk-...' } 
      });
    }
    
    res.json({ message: 'Provider added and models synced', provider: { ...newProvider, apiKey: 'sk-...' } });
  } catch (error) {
    console.error('Error in /providers/add:', error);
    res.status(500).json({ error: `Failed to add provider: ${error.message}` });
  }
});

// Remove a provider
router.post('/providers/remove', isAdmin, async (req, res) => {
  const { providerId } = req.body;
  try {
    const config = await getConfig('system');
    const providers = (config.providers || []).filter(p => p.id !== providerId);
    
    // Also remove models associated with this provider
    const models = await getSystemModels();
    const updatedModels = models.filter(m => m.providerId !== providerId);
    
    await saveConfig('system', { providers });
    await saveSystemModels(updatedModels);
    
    res.json({ message: 'Provider and its models removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove provider' });
  }
});

// Refresh a specific provider's models
router.post('/providers/refresh', isAdmin, async (req, res) => {
  const { providerId } = req.body;
  try {
    const config = await getConfig('system');
    const provider = (config.providers || []).find(p => p.id === providerId);
    
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    await fetchModelsFromProvider(provider);
    const updatedModels = await getSystemModels();
    res.json({ message: `Models refreshed for ${provider.name}`, models: updatedModels });
  } catch (error) {
    console.error('Error refreshing provider:', error);
    res.status(500).json({ error: `Failed to refresh provider: ${error.message}` });
  }
});

async function fetchModelsFromProvider(provider) {
  const url = `${provider.apiBaseUrl.replace(/\/$/, '')}/models`;
  const response = await axios.get(url, {
    headers: { 'Authorization': `Bearer ${provider.apiKey}` }
  });

  const models = response.data.data || response.data;
  const existingModels = await getSystemModels();

  // Remove old models for this provider before adding new ones
  const otherModels = existingModels.filter(m => m.providerId !== provider.id);
  
  const providerModels = models.map(model => {
    const existing = existingModels.find(m => m.id === model.id && m.providerId === provider.id);
    return {
      id: model.id,
      name: model.name || model.id,
      created: model.created,
      owned_by: model.owned_by,
      enabled: existing ? existing.enabled : true,
      providerId: provider.id,
      providerName: provider.name
    };
  });

  await saveSystemModels([...otherModels, ...providerModels]);
}

// Fetch models from all providers
router.post('/fetch-models', isAdmin, async (req, res) => {
  try {
    const config = await getConfig('system');
    const providers = config.providers || [];
    
    if (providers.length === 0) {
      return res.status(400).json({ error: 'No providers configured' });
    }

    for (const provider of providers) {
      try {
        await fetchModelsFromProvider(provider);
      } catch (e) {
        console.error(`Failed to fetch models for provider ${provider.name}:`, e.message);
      }
    }

    const updatedModels = await getSystemModels();
    res.json(updatedModels);
  } catch (error) {
    console.error('Error fetching models:', error.message);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// Get all system models for admin panel
router.get('/models', isAdmin, async (req, res) => {
  const models = await getSystemModels();
  res.json(models);
});

// Toggle model enabled status
router.post('/toggle-model', isAdmin, async (req, res) => {
  const { modelId, providerId, enabled } = req.body;
  
  try {
    const models = await getSystemModels();
    const modelIndex = models.findIndex(m => m.id === modelId && m.providerId === providerId);
    
    if (modelIndex !== -1) {
      models[modelIndex].enabled = enabled;
      await saveSystemModels(models);
      res.json({ message: `Model ${modelId} ${enabled ? 'enabled' : 'disabled'}` });
    } else {
      res.status(404).json({ error: 'Model not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update model status' });
  }
});

module.exports = router;
