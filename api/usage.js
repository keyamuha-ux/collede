const { clerkClient } = require('@clerk/clerk-sdk-node');

const DAILY_LIMIT = 13000;

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

async function checkAndIncrementUsage(userId) {
  if (!userId) return { allowed: false, current: 0, limit: DAILY_LIMIT };

  try {
    const today = getTodayStr();
    const user = await clerkClient.users.getUser(userId);
    
    const usage = user.privateMetadata?.usage || {};
    const currentCount = usage[today] || 0;

    if (currentCount >= DAILY_LIMIT) {
      return { allowed: false, current: currentCount, limit: DAILY_LIMIT };
    }

    const newCount = currentCount + 1;
    
    // Update only today's usage, and maybe clean up old days to stay under 8KB limit
    const updatedUsage = { [today]: newCount };
    
    // Optional: Keep only last 7 days of usage history to save space
    const dates = Object.keys(usage).sort().reverse();
    for (let i = 0; i < Math.min(dates.length, 7); i++) {
      const date = dates[i];
      if (date !== today) {
        updatedUsage[date] = usage[date];
      }
    }

    await clerkClient.users.updateUser(userId, {
      privateMetadata: {
        ...user.privateMetadata,
        usage: updatedUsage
      }
    });

    return { allowed: true, current: newCount, limit: DAILY_LIMIT };
  } catch (error) {
    console.error(`Error tracking usage for ${userId}:`, error);
    // In case of Clerk error, we'll allow the request but log it
    // This prevents blocking users if Clerk is having issues
    return { allowed: true, current: 0, limit: DAILY_LIMIT };
  }
}

async function getUserUsage(userId) {
  if (!userId) return 0;
  
  try {
    const today = getTodayStr();
    const user = await clerkClient.users.getUser(userId);
    return user.privateMetadata?.usage?.[today] || 0;
  } catch (error) {
    console.error(`Error fetching usage for ${userId}:`, error);
    return 0;
  }
}

module.exports = {
  checkAndIncrementUsage,
  getUserUsage,
  DAILY_LIMIT
};
