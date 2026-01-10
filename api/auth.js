const { clerkClient } = require('@clerk/clerk-sdk-node');

/**
 * Authentication middleware that supports:
 * 1. Clerk Session Tokens (for browser-based calls)
 * 2. Collede API Keys (collede-sk-...) for external API calls
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized: Missing Authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  // 1. Check if it's a Collede API Key
  if (token.startsWith('collede-sk-')) {
    try {
      // We need to find the user who owns this key.
      // Since we don't have a database, we'd theoretically need to search all users,
      // which is slow. For this implementation, we'll use a search query if supported,
      // or rely on a specific metadata structure.
      
      // For now, we'll use a simplified approach: we'll assume the client is using 
      // the Clerk session token if they are on the website, and only use API keys 
      // if they are calling externally.
      
      // To find a user by private metadata in Clerk, we'd ideally use a database.
      // Since we are "serverless", we'll implement a cache or a search.
      const users = await clerkClient.users.getUserList({
        // Clerk doesn't support searching by private metadata directly via API easily
        // for security reasons. In a real production app, you'd sync this to a DB.
        // For this "Literature Club" demo, let's assume we store the API keys 
        // in a way that we can identify the user.
      });

      // Find the user with this key
      let foundUser = null;
      for (const user of users) {
        const keys = user.privateMetadata?.apiKeys || [];
        if (keys.find(k => k.key === token)) {
          foundUser = user;
          break;
        }
      }

      if (foundUser) {
        req.auth = { userId: foundUser.id, user: foundUser };
        return next();
      }
      
      return res.status(401).json({ error: 'Invalid Collede API Key' });
    } catch (error) {
      console.error('API Key Auth Error:', error);
      return res.status(500).json({ error: 'Internal Auth Error' });
    }
  }

  // 2. Fallback to Clerk's own session handling (already handled by ClerkExpressWithAuth)
  if (req.auth?.userId) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid token' });
}

module.exports = { authenticate };
