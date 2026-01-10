const { clerkClient } = require('@clerk/clerk-sdk-node');
const fs = require('fs').promises;
const path = require('path');

const MODELS_FILE = path.join(__dirname, '..', 'models_cache.json');

const defaultConfig = {
  providers: []
};

/**
 * Finds the admin user by email.
 * We store the system-wide config in the admin's private metadata.
 */
async function getAdminUser() {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  if (adminEmails.length === 0 || !adminEmails[0]) {
    console.error('ADMIN_EMAILS environment variable is not set');
    return null;
  }

  try {
    // Try to find any of the admins in Clerk, but prefer the first one for config storage
    for (const email of adminEmails) {
      const users = await clerkClient.users.getUserList({ emailAddress: [email] });
      if (users.length > 0) return users[0];
    }
    return null;
  } catch (error) {
    console.error('Error fetching admin user from Clerk:', error);
    return null;
  }
}

async function getConfig(userId = 'system') {
  try {
    if (userId === 'system') {
      const admin = await getAdminUser();
      if (!admin) return defaultConfig;
      
      const config = admin.privateMetadata?.systemConfig;
      // Migration: if config is old format (single provider), convert to array
      if (config && config.apiBaseUrl) {
        return {
          providers: [{
            id: 'default',
            name: 'Default Provider',
            apiBaseUrl: config.apiBaseUrl,
            apiKey: config.apiKey
          }]
        };
      }
      return config || defaultConfig;
    }

    // For specific users, we could allow them to have their own keys
    const user = await clerkClient.users.getUser(userId);
    const userConfig = user.privateMetadata?.config;
    
    // Fallback to system config if user hasn't set their own
    if (!userConfig || (!userConfig.apiKey && !userConfig.apiBaseUrl)) {
      return await getConfig('system');
    }
    
    return { ...defaultConfig, ...userConfig };
  } catch (error) {
    console.error(`Error reading config for ${userId}:`, error);
    return defaultConfig;
  }
}

async function saveConfig(userId, newConfig) {
  if (!userId) return false;
  
  try {
    if (userId === 'system') {
      const admin = await getAdminUser();
      if (!admin) return false;
      
      const currentConfig = admin.privateMetadata?.systemConfig || defaultConfig;
      // Handle both old format and new format for compatibility during migration
      const updatedConfig = { ...currentConfig, ...newConfig };
      
      await clerkClient.users.updateUser(admin.id, {
        privateMetadata: {
          ...admin.privateMetadata,
          systemConfig: updatedConfig
        }
      });
      return true;
    }

    const user = await clerkClient.users.getUser(userId);
    const currentConfig = user.privateMetadata?.config || {};
    const updatedConfig = { ...currentConfig, ...newConfig };

    await clerkClient.users.updateUser(userId, {
      privateMetadata: {
        ...user.privateMetadata,
        config: updatedConfig
      }
    });
    return true;
  } catch (error) {
    console.error(`Error saving config for ${userId}:`, error);
    return false;
  }
}

/**
 * Specifically for storing the models list.
 * We store this in a local file because Clerk's metadata has an 8KB limit,
 * which is too small for a large list of models from multiple providers.
 */
async function getSystemModels() {
  try {
    const data = await fs.readFile(MODELS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Fallback to Clerk if local file doesn't exist yet (migration)
      try {
        const admin = await getAdminUser();
        if (admin && admin.publicMetadata?.models) {
          const models = admin.publicMetadata.models;
          // Save to local file for future use
          await saveSystemModels(models);
          return models;
        }
      } catch (clerkError) {
        console.error('Error fetching system models from Clerk fallback:', clerkError);
      }
      return [];
    }
    console.error('Error reading system models file:', error);
    return [];
  }
}

async function saveSystemModels(models) {
  try {
    await fs.writeFile(MODELS_FILE, JSON.stringify(models, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving system models to file:', error);
    return false;
  }
}

module.exports = { getConfig, saveConfig, getSystemModels, saveSystemModels };
