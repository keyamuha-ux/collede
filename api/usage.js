const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USAGE_FILE = path.join(DATA_DIR, 'usage.json');
const DAILY_LIMIT = 13000;

async function getUsageData() {
  try {
    if (await fs.pathExists(USAGE_FILE)) {
      return await fs.readJson(USAGE_FILE);
    }
  } catch (error) {
    console.error('Error reading usage data:', error);
  }
  return {};
}

async function saveUsageData(data) {
  try {
    await fs.ensureDir(DATA_DIR);
    await fs.writeJson(USAGE_FILE, data, { spaces: 2 });
  } catch (error) {
    console.error('Error saving usage data:', error);
  }
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

async function checkAndIncrementUsage(userId) {
  const today = getTodayStr();
  const usageData = await getUsageData();

  if (!usageData[today]) {
    usageData[today] = {};
  }

  const currentCount = usageData[today][userId] || 0;

  if (currentCount >= DAILY_LIMIT) {
    return { allowed: false, current: currentCount, limit: DAILY_LIMIT };
  }

  usageData[today][userId] = currentCount + 1;
  await saveUsageData(usageData);

  return { allowed: true, current: usageData[today][userId], limit: DAILY_LIMIT };
}

async function getUserUsage(userId) {
  const today = getTodayStr();
  const usageData = await getUsageData();
  return usageData[today]?.[userId] || 0;
}

module.exports = {
  checkAndIncrementUsage,
  getUserUsage,
  DAILY_LIMIT
};
