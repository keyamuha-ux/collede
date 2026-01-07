const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const defaultConfig = {
  apiBaseUrl: '',
  apiKey: ''
};

function getConfigPath(userId) {
  if (userId === 'system') {
    return path.join(DATA_DIR, 'config_system.json');
  }
  return path.join(DATA_DIR, `config_${userId}.json`);
}

async function getConfig(userId = 'system') {
  const configPath = getConfigPath(userId);
  try {
    if (await fs.pathExists(configPath)) {
      return await fs.readJson(configPath);
    }
    // If user config doesn't exist, fall back to system config
    if (userId !== 'system') {
      return await getConfig('system');
    }
    return defaultConfig;
  } catch (error) {
    console.error(`Error reading config for ${userId}:`, error);
    return defaultConfig;
  }
}

async function saveConfig(userId, newConfig) {
  if (!userId) return false;
  const configPath = getConfigPath(userId);
  try {
    const currentConfig = await getConfig(userId);
    const updatedConfig = { ...currentConfig, ...newConfig };
    await fs.writeJson(configPath, updatedConfig, { spaces: 2 });
    return true;
  } catch (error) {
    console.error(`Error saving config for ${userId}:`, error);
    return false;
  }
}

module.exports = { getConfig, saveConfig };
