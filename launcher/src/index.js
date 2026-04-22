const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const DEVICE_ID_FILE = require('path').join(require('os').homedir(), '.openclaw', 'device.id');
const fs = require('fs');

let deviceId = '';
let serverUrl = '';
let uploadInterval = null;
let pendingLogs = [];

function getDeviceId() {
  if (deviceId) return deviceId;
  try {
    const dir = require('path').dirname(DEVICE_ID_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(DEVICE_ID_FILE)) {
      deviceId = fs.readFileSync(DEVICE_ID_FILE, 'utf-8');
    } else {
      deviceId = uuidv4();
      fs.writeFileSync(DEVICE_ID_FILE, deviceId);
    }
  } catch (err) {
    deviceId = uuidv4();
  }
  return deviceId;
}

function log(level, message) {
  const entry = { timestamp: Date.now(), level, message };
  console.log(`[${entry.timestamp}] [${level}] ${message}`);
  pendingLogs.push(entry);
}

async function uploadLogs() {
  if (!serverUrl || pendingLogs.length === 0) return;
  try {
    await axios.post(`${serverUrl}/api/logs`, {
      deviceId: getDeviceId(),
      logs: pendingLogs
    });
    pendingLogs = [];
  } catch (err) {
    console.error('上传日志失败:', err.message);
  }
}

function start(uploadIntervalMs = 30000) {
  log('INFO', `Launcher 启动，设备ID: ${getDeviceId()}`);
  uploadInterval = setInterval(uploadLogs, uploadIntervalMs);
  log('INFO', `日志上传间隔: ${uploadIntervalMs}ms`);
}

function stop() {
  if (uploadInterval) {
    clearInterval(uploadInterval);
    uploadInterval = null;
  }
  uploadLogs();
  log('INFO', 'Launcher 已停止');
}

module.exports = { start, stop, log, getDeviceId, setServerUrl: url => serverUrl = url };
