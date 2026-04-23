const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');

const DEVICE_ID_FILE = path.join(os.homedir(), '.openclaw', 'device.id');
const OPENCLAW_CONFIG_DIR = path.join(os.homedir(), '.openclaw');
const LOCAL_API_PORT = 3003;

let deviceId = '';
let serverUrl = '';
let uploadInterval = null;
let pendingLogs = [];
let gatewayProcess = null;
let openClawStatus = 'stopped';
let installProcess = null;
let installLogs = [];

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
    config: getOpenClawConfig(),
    isInstalling: !!installProcess
  };
}

function installOpenClaw() {
  return new Promise((resolve, reject) => {
    if (installProcess) {
      resolve({ success: false, message: '安装已在进行中' });
      return;
    }

    installLogs = [];
    const isWindows = os.platform() === 'win32';

    const installCmd = isWindows
      ? `powershell -ExecutionPolicy Bypass -Command "& { [scriptblock]::Create((Invoke-WebRequest -useb https://openclaw.ai/install.ps1).Content) -NoOnboard }"`
      : `curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard`;

    log('INFO', '开始静默安装 OpenClaw...', 'install');
    addInstallLog('INFO', '开始安装...');

    installProcess = spawn(isWindows ? 'powershell' : 'bash', isWindows
      ? ['-ExecutionPolicy', 'Bypass', '-Command', `& { [scriptblock]::Create((iwr -useb https://openclaw.ai/install.ps1).Content) -NoOnboard }`]
      : ['-c', installCmd], {
        cwd: os.homedir(),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false
    });

    installProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        addInstallLog('INFO', output);
        log('INFO', output, 'install');
      }
    });

    installProcess.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        addInstallLog('WARN', output);
        log('WARN', output, 'install');
      }
    });

    installProcess.on('close', (code) => {
      addInstallLog(code === 0 ? 'INFO' : 'ERROR', `安装完成，退出码: ${code}`);
      log('INFO', `安装进程退出，代码: ${code}`, 'install');
      installProcess = null;
      openClawStatus = 'installed';
      checkOpenClawStatus();
      resolve({ success: code === 0, exitCode: code, logs: installLogs });
    });

    installProcess.on('error', (err) => {
      addInstallLog('ERROR', `安装失败: ${err.message}`);
      log('ERROR', `安装失败: ${err.message}`, 'install');
      installProcess = null;
      resolve({ success: false, error: err.message });
    });
  });
}

function addInstallLog(level, message) {
  installLogs.push({
    timestamp: Date.now(),
    level,
    message
  });
}

function getExePath() {
  return process.execPath;
}

function getLauncherDir() {
  return path.dirname(getExePath());
}

async function createDesktopShortcut() {
  const exePath = getExePath();
  const desktopPath = path.join(os.homedir(), 'Desktop');
  const shortcutPath = path.join(desktopPath, 'OpenClaw Launcher.lnk');

  return new Promise((resolve) => {
    try {
      if (fs.existsSync(shortcutPath)) {
        log('INFO', '桌面快捷方式已存在', 'shortcut');
        resolve(true);
        return;
      }

      const vbsScript = `
Set WshShell = CreateObject("WScript.Shell")
SetShortcut = WshShell.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
Shortcut.TargetPath = "${exePath.replace(/\\/g, '\\\\')}"
Shortcut.WorkingDirectory = "${getLauncherDir().replace(/\\/g, '\\\\')}"
Shortcut.Description = "OpenClaw Launcher"
Shortcut.Save
`;
      const vbsPath = path.join(os.tmpdir(), 'create_shortcut.vbs');
      fs.writeFileSync(vbsPath, vbsScript);

      exec(`cscript //Nologo "${vbsPath}"`, (err) => {
        if (err) {
          log('WARN', `创建桌面快捷方式失败: ${err.message}`, 'shortcut');
        } else {
          log('INFO', '桌面快捷方式已创建', 'shortcut');
        }
        try { fs.unlinkSync(vbsPath); } catch (e) {}
        resolve(!err);
      });
    } catch (err) {
      log('WARN', `创建桌面快捷方式异常: ${err.message}`, 'shortcut');
      resolve(false);
    }
  });
}

async function registerAutoStart() {
  const exePath = getExePath();
  const taskName = 'OpenClawLauncher';
  const launcherDir = getLauncherDir();

  return new Promise((resolve) => {
    try {
      exec(`schtasks /query /tn "${taskName}" 2>nul`, (err) => {
        if (!err) {
          log('INFO', '开机自启任务已存在', 'autostart');
          resolve(true);
          return;
        }

        const cmd = `schtasks /create /tn "${taskName}" /tr "\\"${exePath}\\"" /sc onlogon /rl limited /f`;
        exec(cmd, (err2, stdout, stderr) => {
          if (err2) {
            log('WARN', `创建开机自启任务失败: ${err2.message}`, 'autostart');
          } else {
            log('INFO', '开机自启任务已创建', 'autostart');
          }
          resolve(!err2);
        });
      });
    } catch (err) {
      log('WARN', `创建开机自启任务异常: ${err.message}`, 'autostart');
      resolve(false);
    }
  });
}

async function setupLauncher() {
  await createDesktopShortcut();
  await registerAutoStart();
}

function startLocalApi() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'GET' && req.url === '/status') {
      res.end(JSON.stringify(getStatus()));
    } else if (req.method === 'GET' && req.url === '/install/logs') {
      res.end(JSON.stringify({ logs: installLogs }));
    } else if (req.method === 'POST' && req.url === '/install/start') {
      installOpenClaw().then(result => {
        res.end(JSON.stringify(result));
      });
    } else if (req.method === 'GET' && req.url === '/install/status') {
      res.end(JSON.stringify({ running: !!installProcess, logs: installLogs }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });

  server.listen(LOCAL_API_PORT, '127.0.0.1', () => {
    log('INFO', `本地API服务已启动: http://127.0.0.1:${LOCAL_API_PORT}`, 'api');
  });

  return server;
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
  getOpenClawConfig,
  installOpenClaw,
  startLocalApi,
  createDesktopShortcut,
  registerAutoStart,
  setupLauncher
};

if (require.main === module) {
  const localApiServer = startLocalApi();
  start(30000);

  setupLauncher();

  console.log('OpenClaw Launcher 已启动');
  console.log(`本地API: http://127.0.0.1:${LOCAL_API_PORT}`);
  console.log('按 Ctrl+C 停止');

  process.on('SIGINT', () => {
    console.log('\n正在停止 Launcher...');
    stop();
    localApiServer.close();
    process.exit(0);
  });
}
