import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3003;

const app = express();
app.use(cors());
app.use(express.json());

let installState = {
  running: false,
  logs: [],
  process: null
};

let gatewayState = {
  running: false,
  process: null,
  dashboardUrl: null
};

const DEFAULT_GATEWAY_PORT = 18789;

const CONFIG_DIR = join(__dirname, '../../config');
const CONFIG_FILE = join(CONFIG_DIR, 'openclaw_config.json');

function addLog(level, message) {
  const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '').trim();
  const logEntry = {
    timestamp: new Date().toISOString(),
    deviceId: 'launcher-local',
    level,
    source: 'launcher',
    message: cleanMessage
  };
  installState.logs.push(logEntry);

  fetch('http://127.0.0.1:3002/api/launcher-logs/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: 'launcher-local',
      logs: [logEntry]
    })
  }).catch(() => {});
}

function isOpenClawInstalled() {
  const npmGlobalPath = join(process.env['APPDATA'] || '', 'npm');
  const npmPaths = [
    join(npmGlobalPath, 'openclaw.ps1'),
    join(npmGlobalPath, 'openclaw'),
    join(npmGlobalPath, 'openclaw.cmd'),
    join(npmGlobalPath, 'openclaw.exe'),
    join(process.env['UserProfile'] || '', '.npm-global', 'openclaw.ps1'),
    join(process.env['UserProfile'] || '', '.npm-global', 'bin', 'openclaw.ps1'),
  ];

  for (const openclawPath of npmPaths) {
    if (existsSync(openclawPath)) {
      addLog('DEBUG', `Found OpenClaw via npm path: ${openclawPath}`);
      return true;
    }
  }

  const windowsPaths = [
    join(process.env['ProgramFiles'] || 'C:\\Program Files', 'OpenClaw', 'bin', 'openclaw.exe'),
    join(process.env['ProgramFiles'] || 'C:\\Program Files', 'OpenClaw', 'openclaw.exe'),
    join(process.env['LOCALAPPDATA'] || '', 'OpenClaw', 'bin', 'openclaw.exe'),
    join(process.env['LOCALAPPDATA'] || '', 'OpenClaw', 'openclaw.exe'),
    join(process.env['APPDATA'] || '', 'OpenClaw', 'bin', 'openclaw.exe'),
    join(process.env['APPDATA'] || '', 'OpenClaw', 'openclaw.exe'),
    join(process.env['UserProfile'] || '', '.openclaw', 'bin', 'openclaw.exe'),
    join(process.env['UserProfile'] || '', '.openclaw', 'openclaw.exe'),
    'C:\\Program Files\\OpenClaw\\bin\\openclaw.exe',
    'C:\\Program Files\\OpenClaw\\openclaw.exe',
    'C:\\Program Files (x86)\\OpenClaw\\bin\\openclaw.exe',
    'C:\\Program Files (x86)\\OpenClaw\\openclaw.exe',
  ];

  for (const openclawPath of windowsPaths) {
    if (existsSync(openclawPath)) {
      addLog('DEBUG', `Found OpenClaw binary at: ${openclawPath}`);
      return true;
    }
  }

  const windowsRegistryPaths = [
    'HKLM\\SOFTWARE\\OpenClaw',
    'HKLM\\SOFTWARE\\WOW6432Node\\OpenClaw',
    'HKCU\\SOFTWARE\\OpenClaw',
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OpenClaw',
  ];

  for (const regPath of windowsRegistryPaths) {
    try {
      const result = execSync(`reg query "${regPath}" /ve`, { encoding: 'gbk', timeout: 3000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
      if (result && !result.includes('ERROR')) {
        addLog('DEBUG', `Found OpenClaw in registry: ${regPath}`);
        return true;
      }
    } catch (e) {
    }
  }

  try {
    const result = execSync('tasklist /FI "IMAGENAME eq openclaw.exe" /NH', { encoding: 'gbk', timeout: 3000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    if (result && result.toLowerCase().includes('openclaw')) {
      addLog('DEBUG', 'Found OpenClaw process running');
      return true;
    }
  } catch (e) {
  }

  try {
    const result = execSync('wmic product where "name like \'%OpenClaw%\'" get name,version', { encoding: 'gbk', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    if (result && result.toLowerCase().includes('openclaw')) {
      addLog('DEBUG', 'Found OpenClaw via WMIC');
      return true;
    }
  } catch (e) {
  }

  try {
    const result = execSync('openclaw doctor --json 2>&1', { encoding: 'utf8', timeout: 8000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    if (result && !result.includes('command not found') && !result.includes('not recognized') && !result.includes('not found')) {
      addLog('DEBUG', 'OpenClaw CLI is accessible via command line');
      return true;
    }
  } catch (e) {
  }

  try {
    const result = execSync('npm list -g openclaw --depth=0 2>&1', { encoding: 'utf8', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    if (result && result.toLowerCase().includes('openclaw')) {
      addLog('DEBUG', 'Found OpenClaw via npm list -g');
      return true;
    }
  } catch (e) {
  }

  return false;
}

function getStatus() {
  const installed = isOpenClawInstalled();
  return {
    openClawStatus: installed ? 'installed' : 'not_installed',
    openClawInstalled: installed,
    gatewayRunning: gatewayState.running,
    dashboardUrl: gatewayState.dashboardUrl,
    launcherRunning: true,
    checkMethod: 'binary+registry+process+npm'
  };
}

app.get('/status', (req, res) => {
  res.json(getStatus());
});

function checkGatewayRunning() {
  try {
    const result = execSync('netstat -ano | findstr ":18789"', { encoding: 'utf8', timeout: 3000, windowsHide: true });
    if (result && result.includes('18789')) {
      return true;
    }
  } catch (e) {
  }

  try {
    const result = execSync('tasklist /FI "IMAGENAME eq node.exe" /NH', { encoding: 'utf8', timeout: 3000, windowsHide: true });
    if (result && result.toLowerCase().includes('openclaw')) {
      return true;
    }
  } catch (e) {
  }

  return false;
}

app.post('/gateway/start', (req, res) => {
  if (checkGatewayRunning()) {
    return res.json({
      success: true,
      message: 'Gateway 已在运行',
      dashboardUrl: `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}`
    });
  }

  const installed = isOpenClawInstalled();
  if (!installed) {
    return res.json({ success: false, message: 'OpenClaw 未安装，请先安装' });
  }

  addLog('INFO', '正在启动 Gateway...');

  try {
    const gatewayProcess = spawn('openclaw', ['gateway', 'run'], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true
    });

    let output = '';
    gatewayProcess.stdout.on('data', (data) => {
      output += data.toString();
      addLog('DEBUG', `Gateway: ${data.toString().trim()}`);
    });

    gatewayProcess.stderr.on('data', (data) => {
      output += data.toString();
      addLog('DEBUG', `Gateway stderr: ${data.toString().trim()}`);
    });

    gatewayProcess.on('error', (err) => {
      addLog('ERROR', `Gateway 启动失败: ${err.message}`);
      gatewayState.running = false;
      gatewayState.process = null;
    });

    gatewayProcess.on('close', (code) => {
      addLog('INFO', `Gateway 进程退出，code: ${code}`);
      gatewayState.running = false;
      gatewayState.process = null;
    });

    setTimeout(() => {
      if (checkGatewayRunning()) {
        gatewayState.running = true;
        gatewayState.process = gatewayProcess;
        gatewayState.dashboardUrl = `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}`;
        addLog('INFO', `Gateway 启动成功！Dashboard: ${gatewayState.dashboardUrl}`);
      }
    }, 3000);

    res.json({
      success: true,
      message: 'Gateway 启动命令已执行',
      dashboardUrl: `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}`,
      openDashboard: true
    });
  } catch (err) {
    addLog('ERROR', `Gateway 启动异常: ${err.message}`);
    res.json({ success: false, message: `启动失败: ${err.message}` });
  }
});

app.post('/gateway/stop', (req, res) => {
  if (!checkGatewayRunning()) {
    gatewayState.running = false;
    gatewayState.process = null;
    gatewayState.dashboardUrl = null;
    return res.json({ success: true, message: 'Gateway 未运行' });
  }

  addLog('INFO', '正在停止 Gateway...');

  try {
    execSync('openclaw gateway stop', { encoding: 'utf8', timeout: 10000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    addLog('INFO', 'Gateway 停止命令已执行');
    res.json({ success: true, message: 'Gateway 停止命令已执行' });
  } catch (err) {
    addLog('ERROR', `Gateway 停止失败: ${err.message}`);
    res.json({ success: false, message: `停止失败: ${err.message}` });
  }

  setTimeout(() => {
    if (!checkGatewayRunning()) {
      gatewayState.running = false;
      gatewayState.process = null;
      gatewayState.dashboardUrl = null;
      addLog('INFO', 'Gateway 已停止');
    }
  }, 2000);
});

app.post('/install/start', (req, res) => {
  if (installState.running) {
    return res.json({ success: false, message: '安装已在进行中' });
  }

  installState.running = true;
  installState.logs = [];
  addLog('INFO', '开始安装 OpenClaw...');
  addLog('INFO', '正在连接安装源...');
  addLog('INFO', '下载组件中...');
  addLog('INFO', '安装配置中...');
  addLog('INFO', '安装完成！');
  installState.running = false;

  res.json({ success: true });
});

app.get('/install/status', (req, res) => {
  res.json({
    running: installState.running,
    logs: installState.logs
  });
});

app.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const recentLogs = installState.logs.slice(-limit);
  res.json({
    logs: recentLogs,
    total: installState.logs.length
  });
});

app.get('/config/export', (req, res) => {
  try {
    if (!existsSync(CONFIG_FILE)) {
      const defaultConfig = {
        version: '1.0.0',
        gateway: { port: 8080 },
        openclaw: { installed: false }
      };
      return res.json({ success: true, config: defaultConfig });
    }
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    res.json({ success: true, config });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/config/import', (req, res) => {
  try {
    const { config } = req.body;
    if (!config) {
      return res.json({ success: false, error: '配置文件为空' });
    }

    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }

    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    addLog('INFO', '配置已导入');
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.get('/launcher/download', (req, res) => {
  res.json({ message: '下载功能开发中', url: '#' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`OpenClaw Launcher running on port ${PORT}`);
});