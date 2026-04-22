const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const DEVICE_ID_FILE = path.join(os.homedir(), '.openclaw', 'device.id');
const OPENCLAW_CONFIG_DIR = path.join(os.homedir(), '.openclaw');

let deviceId = '';
let serverUrl = '';
let uploadInterval = null;
let pendingLogs = [];
let gatewayProcess = null;
let openClawStatus = 'stopped';

function getDeviceId() {
  if (deviceId) return deviceId;
  try {
    const dir = path.dirname(DEVICE_ID_FILE);
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

function log(level, message, source = 'launcher') {
  const entry = { timestamp: Date.now(), level, message, source };
  console.log(`[${new Date().toLocaleString()}] [${source}] [${level}] ${message}`);
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
  checkOpenClawStatus();
}

function stop() {
  if (uploadInterval) {
    clearInterval(uploadInterval);
    uploadInterval = null;
  }
  uploadLogs();
  log('INFO', 'Launcher 已停止');
}

function checkOpenClawStatus() {
  const configPath = path.join(OPENCLAW_CONFIG_DIR, 'openclaw.json');
  const isInstalled = fs.existsSync(configPath);
  openClawStatus = isInstalled ? 'installed' : 'not_installed';
  log('INFO', `OpenClaw状态: ${openClawStatus}`, 'launcher');
  return openClawStatus;
}

function getOpenClawConfig() {
  try {
    const configPath = path.join(OPENCLAW_CONFIG_DIR, 'openclaw.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (err) {
    log('ERROR', `读取配置失败: ${err.message}`, 'launcher');
  }
  return null;
}

function startGateway() {
  return new Promise((resolve, reject) => {
    log('INFO', '正在启动 Gateway...', 'launcher');
    
    const isWindows = os.platform() === 'win32';
    const shell = isWindows ? 'cmd.exe' : '/bin/bash';
    const args = isWindows ? ['/c', 'openclaw', 'gateway', 'start'] : ['-c', 'openclaw gateway start'];
    
    gatewayProcess = spawn(shell, args, {
      cwd: os.homedir(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    gatewayProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) log('INFO', output, 'gateway');
    });

    gatewayProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output) log('ERROR', output, 'gateway');
    });

    gatewayProcess.on('close', (code) => {
      log('INFO', `Gateway进程退出，代码: ${code}`, 'gateway');
      gatewayProcess = null;
    });

    setTimeout(() => {
      openClawStatus = 'running';
      resolve({ success: true, message: 'Gateway启动中' });
    }, 2000);
  });
}

function stopGateway() {
  return new Promise((resolve) => {
    log('INFO', '正在停止 Gateway...', 'launcher');
    
    if (gatewayProcess) {
      gatewayProcess.kill();
      gatewayProcess = null;
    }

    const isWindows = os.platform() === 'win32';
    const cmd = isWindows 
      ? 'taskkill /F /IM node.exe /FI "WINDOWTITLE eq *openclaw*gateway*"'
      : 'pkill -f "openclaw.*gateway"';

    exec(cmd, (err) => {
      openClawStatus = 'stopped';
      log('INFO', 'Gateway已停止', 'launcher');
      resolve({ success: true, message: 'Gateway已停止' });
    });
  });
}

function getStatus() {
  return {
    deviceId: getDeviceId(),
    openClawStatus,
    gatewayRunning: !!gatewayProcess,
    serverUrl,
    logsCount: pendingLogs.length,
    config: getOpenClawConfig()
  };
}

module.exports = { 
  start, 
  stop, 
  log, 
  getDeviceId, 
  setServerUrl: url => serverUrl = url,
  getStatus,
  startGateway,
  stopGateway,
  checkOpenClawStatus,
  getOpenClawConfig
};
