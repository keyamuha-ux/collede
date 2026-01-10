const express = require('express');
const router = express.Router();
const { clerkClient } = require('@clerk/clerk-sdk-node');
const crypto = require('crypto');
const { getUserUsage, DAILY_LIMIT } = require('./usage');

// Get user dashboard data (keys + usage)
router.get('/data', async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await clerkClient.users.getUser(userId);
    const usage = await getUserUsage(userId);
    const keys = user.privateMetadata?.apiKeys || [];

    // Only return masked keys
    const maskedKeys = keys.map(k => ({
      id: k.id,
      name: k.name,
      key: `collede-sk-...${k.key.slice(-4)}`,
      created: k.created
    }));

    res.json({
      usage: {
        current: usage,
        limit: DAILY_LIMIT
      },
      keys: maskedKeys
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate new API key
router.post('/keys', async (req, res) => {
  const userId = req.auth?.userId;
  const { name } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await clerkClient.users.getUser(userId);
    const currentKeys = user.privateMetadata?.apiKeys || [];

    if (currentKeys.length >= 5) {
      return res.status(400).json({ error: 'Maximum 5 keys allowed' });
    }

    const newKey = `collede-sk-${crypto.randomBytes(24).toString('hex')}`;
    const keyId = crypto.randomUUID();
    
    const keyData = {
      id: keyId,
      name: name || `Club Key ${currentKeys.length + 1}`,
      key: newKey, // In a real app, we'd hash this, but for simple gateway we store it
      created: new Date().toISOString()
    };

    await clerkClient.users.updateUser(userId, {
      privateMetadata: {
        ...user.privateMetadata,
        apiKeys: [...currentKeys, keyData]
      }
    });

    // Return the FULL key only once
    res.json({ ...keyData, key: newKey });
  } catch (error) {
    console.error('Error generating key:', error);
    res.status(500).json({ error: 'Failed to generate key' });
  }
});

// Revoke API key
router.delete('/keys/:id', async (req, res) => {
  const userId = req.auth?.userId;
  const keyId = req.params.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await clerkClient.users.getUser(userId);
    const currentKeys = user.privateMetadata?.apiKeys || [];
    const updatedKeys = currentKeys.filter(k => k.id !== keyId);

    await clerkClient.users.updateUser(userId, {
      privateMetadata: {
        ...user.privateMetadata,
        apiKeys: updatedKeys
      }
    });

    res.json({ message: 'Key revoked successfully' });
  } catch (error) {
    console.error('Error revoking key:', error);
    res.status(500).json({ error: 'Failed to revoke key' });
  }
});

module.exports = router;
