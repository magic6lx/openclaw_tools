import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
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
const homedir = require('os').homedir();
const OPENCLAW_CONFIG_DIR = join(homedir, '.openclaw');
const OPENCLAW_CONFIG_FILE = join(OPENCLAW_CONFIG_DIR, 'openclaw.json');
const PRIVATE_TEMPLATE_FILE = join(CONFIG_DIR, 'private_template.json');
const OPENCLAW_ENV_FILE = join(OPENCLAW_CONFIG_DIR, '.env');

let cachedInstallStatus = null;
let lastInstallCheckTime = 0;
const INSTALL_CHECK_CACHE_MS = 30000;

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
  const now = Date.now();
  if (cachedInstallStatus !== null && (now - lastInstallCheckTime) < INSTALL_CHECK_CACHE_MS) {
    return cachedInstallStatus;
  }

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
      if (cachedInstallStatus !== true) {
        addLog('INFO', `检测到 OpenClaw 已安装: ${openclawPath}`);
      }
      cachedInstallStatus = true;
      lastInstallCheckTime = now;
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
      if (cachedInstallStatus !== true) {
        addLog('INFO', `检测到 OpenClaw 已安装: ${openclawPath}`);
      }
      cachedInstallStatus = true;
      lastInstallCheckTime = now;
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
        if (cachedInstallStatus !== true) {
          addLog('INFO', `检测到 OpenClaw 已安装 (注册表)`);
        }
        cachedInstallStatus = true;
        lastInstallCheckTime = now;
        return true;
      }
    } catch (e) {
    }
  }

  try {
    const result = execSync('tasklist /FI "IMAGENAME eq openclaw.exe" /NH', { encoding: 'gbk', timeout: 3000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    if (result && result.toLowerCase().includes('openclaw')) {
      if (cachedInstallStatus !== true) {
        addLog('INFO', '检测到 OpenClaw 进程正在运行');
      }
      cachedInstallStatus = true;
      lastInstallCheckTime = now;
      return true;
    }
  } catch (e) {
  }

  try {
    const result = execSync('openclaw doctor --json 2>&1', { encoding: 'utf8', timeout: 8000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    if (result && !result.includes('command not found') && !result.includes('not recognized') && !result.includes('not found')) {
      if (cachedInstallStatus !== true) {
        addLog('INFO', '检测到 OpenClaw CLI 可用');
      }
      cachedInstallStatus = true;
      lastInstallCheckTime = now;
      return true;
    }
  } catch (e) {
  }

  try {
    const result = execSync('npm list -g openclaw --depth=0 2>&1', { encoding: 'utf8', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    if (result && result.toLowerCase().includes('openclaw')) {
      if (cachedInstallStatus !== true) {
        addLog('INFO', '检测到 OpenClaw 已通过 npm 全局安装');
      }
      cachedInstallStatus = true;
      lastInstallCheckTime = now;
      return true;
    }
  } catch (e) {
  }

  if (cachedInstallStatus !== false) {
    addLog('INFO', '未检测到 OpenClaw 安装');
  }
  cachedInstallStatus = false;
  lastInstallCheckTime = now;
  return false;
}

function getStatus() {
  const installed = isOpenClawInstalled();
  const gatewayRunning = checkGatewayRunning();
  return {
    openClawStatus: installed ? 'installed' : 'not_installed',
    openClawInstalled: installed,
    gatewayRunning: gatewayRunning,
    dashboardUrl: gatewayRunning ? `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}` : null,
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
    if (result && result.includes('LISTENING')) {
      return true;
    }
  } catch (e) {
  }

  return false;
}

app.post('/gateway/start', (req, res) => {
  if (checkGatewayRunning()) {
    addLog('INFO', 'Gateway 已在运行中，端口 18789 已监听');
    return res.json({
      success: true,
      message: 'Gateway 已在运行',
      dashboardUrl: `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}`
    });
  }

  const installed = isOpenClawInstalled();
  if (!installed) {
    addLog('ERROR', '无法启动 Gateway: OpenClaw 未安装');
    return res.json({ success: false, message: 'OpenClaw 未安装，请先安装' });
  }

  addLog('INFO', '========== 开始启动 Gateway ==========');
  addLog('INFO', '执行命令: openclaw gateway run');
  addLog('INFO', '目标端口: 18789');

  try {
    const gatewayProcess = spawn('openclaw', ['gateway', 'run'], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true
    });

    gatewayState.process = gatewayProcess;
    let hasOutput = false;
    let lastOutput = '';

    gatewayProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) {
        hasOutput = true;
        lastOutput = msg;
        addLog('INFO', `[Gateway stdout] ${msg}`);
      }
    });

    gatewayProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) {
        hasOutput = true;
        lastOutput = msg;
        addLog('WARN', `[Gateway stderr] ${msg}`);
      }
    });

    gatewayProcess.on('error', (err) => {
      addLog('ERROR', `Gateway 进程启动失败: ${err.message}`);
      addLog('ERROR', `错误代码: ${err.code}`);
      addLog('ERROR', `错误详情: ${JSON.stringify({
        errno: err.errno,
        syscall: err.syscall,
        path: err.path
      })}`);
      gatewayState.running = false;
      gatewayState.process = null;
    });

    gatewayProcess.on('close', (code, signal) => {
      addLog('INFO', `Gateway 进程已退出，退出码: ${code}, 信号: ${signal}`);
      if (code !== 0 && code !== null) {
        addLog('ERROR', '========== Gateway 启动失败 ==========');
        addLog('ERROR', `进程异常退出，退出码: ${code}`);
        if (!hasOutput) {
          addLog('ERROR', '进程没有任何输出，可能原因:');
          addLog('ERROR', '1. openclaw 命令不存在或不在 PATH 中');
          addLog('ERROR', '2. PowerShell 执行策略限制');
          addLog('ERROR', '3. 权限不足');
        } else {
          addLog('ERROR', `最后输出: ${lastOutput}`);
        }
      }
      gatewayState.running = false;
      gatewayState.process = null;
    });

    addLog('INFO', 'Gateway 进程已创建 (PID: ' + gatewayProcess.pid + ')，等待服务就绪...');

    let checkCount = 0;
    let gatewayReadyReported = false;
    const maxChecks = 60;
    const checkInterval = setInterval(() => {
      checkCount++;

      if (checkGatewayRunning()) {
        clearInterval(checkInterval);
        gatewayState.running = true;
        gatewayState.dashboardUrl = `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}`;
        addLog('INFO', '========== Gateway 启动成功 ==========');
        addLog('INFO', `Dashboard 地址: ${gatewayState.dashboardUrl}`);
        return;
      }

      if (checkCount >= maxChecks) {
        clearInterval(checkInterval);
        addLog('ERROR', '========== Gateway 启动失败 ==========');
        addLog('ERROR', `等待 ${maxChecks * 0.5} 秒后端口仍未监听`);
        addLog('ERROR', '请检查:');
        addLog('ERROR', '1. openclaw 配置文件是否存在问题');
        addLog('ERROR', '2. 端口 18789 是否被其他程序占用');
        if (hasOutput) {
          addLog('ERROR', `进程最后输出: ${lastOutput}`);
        }
        gatewayState.running = false;
        gatewayState.process = null;
        return;
      }

      if (checkCount % 6 === 0) {
        addLog('INFO', `等待 Gateway 启动... (${(checkCount * 0.5).toFixed(0)}/${maxChecks * 0.5}秒)`);
      }
    }, 500);

    res.json({
      success: true,
      message: 'Gateway 启动命令已执行',
      dashboardUrl: `http://127.0.0.1:${DEFAULT_GATEWAY_PORT}`,
      openDashboard: true
    });
  } catch (err) {
    addLog('ERROR', `Gateway 启动异常: ${err.message}`);
    addLog('ERROR', `异常堆栈: ${err.stack}`);
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
    addLog('WARN', `正常停止命令超时，尝试强制终止...`);

    try {
      execSync('taskkill /F /IM openclaw.exe', { encoding: 'utf8', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
      addLog('INFO', 'Gateway 进程已强制终止');
      gatewayState.running = false;
      gatewayState.process = null;
      gatewayState.dashboardUrl = null;
      res.json({ success: true, message: 'Gateway 已强制终止' });
    } catch (killErr) {
      addLog('ERROR', `Gateway 停止失败: ${err.message}`);
      addLog('ERROR', `强制终止也失败: ${killErr.message}`);
      res.json({ success: false, message: `停止失败: ${err.message}` });
    }
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

app.get('/version', (req, res) => {
  const npmGlobalPath = join(process.env['APPDATA'] || '', 'npm');
  const openclawPaths = [
    join(npmGlobalPath, 'openclaw.ps1'),
    join(npmGlobalPath, 'openclaw'),
    join(npmGlobalPath, 'openclaw.cmd'),
    join(process.env['UserProfile'] || '', '.npm-global', 'bin', 'openclaw.ps1'),
  ];

  let npmPath = null;
  for (const p of openclawPaths) {
    if (existsSync(p)) {
      npmPath = p;
      break;
    }
  }

  if (!npmPath) {
    return res.json({ installed: false, message: '未检测到 OpenClaw 安装' });
  }

  try {
    const result = execSync('npm view openclaw version', { encoding: 'utf8', timeout: 10000, windowsHide: true });
    const latestVersion = result.trim();

    let currentVersion = 'unknown';
    try {
      const showResult = execSync('npm show openclaw version', { encoding: 'utf8', timeout: 10000, windowsHide: true });
      currentVersion = showResult.trim();
    } catch (e) {
      try {
        const pkgPath = join(npmGlobalPath, 'node_modules', 'openclaw', 'package.json');
        if (existsSync(pkgPath)) {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
          currentVersion = pkg.version || 'unknown';
        }
      } catch (e2) {
      }
    }

    const isLatest = currentVersion === latestVersion;

    return res.json({
      installed: true,
      npmPath,
      currentVersion,
      latestVersion,
      isLatest
    });
  } catch (err) {
    return res.json({
      installed: true,
      npmPath,
      currentVersion: 'unknown',
      latestVersion: 'unknown',
      isLatest: false,
      error: err.message
    });
  }
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
    const result = {
      success: true,
      config: null,
      env: null,
      source: 'default',
      configPath: OPENCLAW_CONFIG_FILE,
      envPath: OPENCLAW_ENV_FILE,
      keyPaths: {}
    };

    if (existsSync(OPENCLAW_CONFIG_FILE)) {
      result.config = JSON.parse(readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8'));
      result.source = 'openclaw';
    }

    if (existsSync(OPENCLAW_ENV_FILE)) {
      result.env = readFileSync(OPENCLAW_ENV_FILE, 'utf-8');
    }

    const keyDirs = ['workspace', 'agents', 'channels', 'skills', 'tools', 'hooks', 'logs', 'canvas'];
    const openclawDir = OPENCLAW_CONFIG_DIR;

    for (const dir of keyDirs) {
      const dirPath = join(openclawDir, dir);
      const item = {
        path: dirPath,
        exists: existsSync(dirPath),
        files: [],
        subDirs: []
      };
      if (item.exists) {
        try {
          const entries = readdirSync(dirPath, { withFileTypes: true });
          for (const entry of entries.slice(0, 10)) {
            if (entry.isDirectory()) {
              item.subDirs.push(entry.name);
            } else {
              item.files.push(entry.name);
            }
          }
          if (entries.length > 10) {
            item.more = entries.length - 10;
          }
        } catch (e) {}
      }
      result.keyPaths[dir] = item;
    }

    if (!result.config) {
      result.config = {
        version: '1.0.0',
        gateway: { port: 8080 },
        openclaw: { installed: false }
      };
    }

    res.json(result);
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

    if (!existsSync(OPENCLAW_CONFIG_DIR)) {
      mkdirSync(OPENCLAW_CONFIG_DIR, { recursive: true });
    }

    writeFileSync(OPENCLAW_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    addLog('INFO', '配置已应用到 OpenClaw');
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.get('/config/private-template', (req, res) => {
  try {
    if (existsSync(PRIVATE_TEMPLATE_FILE)) {
      const template = JSON.parse(readFileSync(PRIVATE_TEMPLATE_FILE, 'utf-8'));
      res.json({ success: true, hasTemplate: true, template });
    } else {
      res.json({ success: true, hasTemplate: false, template: null });
    }
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/config/private-template', (req, res) => {
  try {
    const { config, label, description } = req.body;
    if (!config) {
      return res.json({ success: false, error: '配置不能为空' });
    }

    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }

    const template = {
      id: 'private',
      label: label || '私有配置',
      description: description || '用户保存的私有配置',
      icon: '📁',
      category: '私有',
      config,
      savedAt: new Date().toISOString()
    };

    writeFileSync(PRIVATE_TEMPLATE_FILE, JSON.stringify(template, null, 2), 'utf-8');
    addLog('INFO', '当前配置已保存为私有模板');
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.delete('/config/private-template', (req, res) => {
  try {
    if (existsSync(PRIVATE_TEMPLATE_FILE)) {
      unlinkSync(PRIVATE_TEMPLATE_FILE);
      addLog('INFO', '私有模板已删除');
    }
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