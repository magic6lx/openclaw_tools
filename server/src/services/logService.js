const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const LOGS_DIR = path.join(__dirname, '../../logs');

async function ensureLogsDir() {
  await fs.mkdir(LOGS_DIR, { recursive: true });
}

async function saveLogs(deviceId, logs) {
  await ensureLogsDir();
  const filePath = path.join(LOGS_DIR, `launcher-${deviceId}.log`);
  const entries = logs.map(log => {
    const timestamp = log.timestamp || Date.now();
    const level = log.level || 'INFO';
    const message = log.message || '';
    return `[${new Date(timestamp).toISOString()}] [${level}] ${message}`;
  }).join('\n');
  await fs.appendFile(filePath, entries + '\n');
}

async function getLogs(deviceId, limit = 500) {
  await ensureLogsDir();
  const files = await fs.readdir(LOGS_DIR);
  const logFiles = files.filter(f => f.startsWith('launcher-') && f.endsWith('.log'));
  const allLogs = [];

  for (const file of logFiles) {
    if (deviceId && !file.includes(deviceId)) continue;
    const filePath = path.join(LOGS_DIR, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    const fileDeviceId = file.replace('launcher-', '').replace('.log', '');

    for (const line of lines) {
      const timeMatch = line.match(/\[(.*?)\]/);
      allLogs.push({
        deviceId: fileDeviceId,
        message: line,
        timestamp: timeMatch ? new Date(timeMatch[1]).getTime() : 0
      });
    }
  }

  allLogs.sort((a, b) => b.timestamp - a.timestamp);
  return allLogs.slice(0, limit);
}

module.exports = { saveLogs, getLogs };
