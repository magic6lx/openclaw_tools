import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, appendFileSync, renameSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import crypto from 'crypto';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3003;

const app = express();
app.use(cors());
app.use(express.json());

const homedir = os.homedir(); // Ensure homedir is defined
const DEFAULT_GATEWAY_PORT = 18789;

// Use OPENCLAW_TEST_DIR if defined for manifests only, otherwise default to ~/.openclaw
const OPENCLAW_CONFIG_DIR = join(homedir, '.openclaw');
const MANIFEST_DIR = process.env.OPENCLAW_TEST_DIR ?
  join(process.cwd(), process.env.OPENCLAW_TEST_DIR, 'manifests') :
  join(OPENCLAW_CONFIG_DIR, 'manifests');

const OPENCLAW_CONFIG_FILE = join(OPENCLAW_CONFIG_DIR, 'openclaw.json');
const OPENCLAW_ENV_FILE = join(OPENCLAW_CONFIG_DIR, '.env');
const PRIVATE_TEMPLATE_DIR = join(OPENCLAW_CONFIG_DIR, 'private_templates');
const LAUNCHER_DEVICE_ID_FILE = join(OPENCLAW_CONFIG_DIR, 'device_id');
const SNAPSHOT_DIR = join(OPENCLAW_CONFIG_DIR, 'snapshots');
const APPLY_RECORD_DIR = join(OPENCLAW_CONFIG_DIR, 'apply_records');
const LAUNCHER_JSONL_LOG = join(OPENCLAW_CONFIG_DIR, 'logs', 'launcher.jsonl');

const INSTALL_CHECK_CACHE_MS = 30 * 1000;
const LOG_RETENTION_DAYS = 7;

let cachedInstallStatus = null;
let lastInstallCheckTime = 0;

const installState = {
  running: false,
  process: null,
  logs: [],
};

const gatewayState = {
  running: false,
  process: null,
  dashboardUrl: null
};

let globalDeviceId = null; // Global variable to store device ID

// Generate or load device ID on startup
if (existsSync(LAUNCHER_DEVICE_ID_FILE)) {
  globalDeviceId = readFileSync(LAUNCHER_DEVICE_ID_FILE, 'utf-8');
} else {
  // Simple UUID generation for device ID
  globalDeviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  // Ensure .openclaw directory exists before writing device ID
  if (!existsSync(OPENCLAW_CONFIG_DIR)) {
    mkdirSync(OPENCLAW_CONFIG_DIR, { recursive: true });
  }
  writeFileSync(LAUNCHER_DEVICE_ID_FILE, globalDeviceId, 'utf-8');
}

// Default Manifest for Template Generation & Application
const DEFAULT_TEMPLATE_MANIFEST = {
  bundleDirs: ['workspace', 'skills'],
  normalizePaths: {
    'agents.defaults.workspace': 'workspace',
    'logging.file': 'logs/openclaw.log'
  }
};

let SYSTEM_CONFIG_CACHE = {};
let SYSTEM_CONFIG_FETCHED = false;

async function fetchSystemConfigFromServer() {
  const serverUrl = getServerUrl();
  addLog('INFO', `[system_config] 正在从 ${serverUrl} 拉取 manifest 规则...`);
  const response = await fetch(`${serverUrl}/api/system-config?category=manifest`);
  if (!response.ok) {
    throw new Error(`[system_config] 获取 manifest 规则失败: HTTP ${response.status} (${serverUrl})`);
  }
  const json = await response.json();
  if (!json.success || !Array.isArray(json.data)) {
    throw new Error(`[system_config] 获取 manifest 规则返回格式错误`);
  }
  const manifestRules = {};
  for (const r of json.data) {
    if (r.is_active) {
      manifestRules[r.name] = r.value;
    }
  }
  SYSTEM_CONFIG_CACHE = { ...SYSTEM_CONFIG_CACHE, ...manifestRules };
  addLog('INFO', `[system_config] 已从服务端拉取 manifest 规则，当前缓存: ${Object.keys(SYSTEM_CONFIG_CACHE).join(', ')}`);
}

async function fetchMigrationRulesFromServer() {
  const serverUrl = getServerUrl();
  addLog('INFO', `[system_config] 正在从 ${serverUrl} 拉取 migration 规则...`);
  const response = await fetch(`${serverUrl}/api/system-config?category=migration`);
  if (!response.ok) {
    throw new Error(`[system_config] 获取 migration 规则失败: HTTP ${response.status} (${serverUrl})`);
  }
  const json = await response.json();
  if (!json.success || !Array.isArray(json.data)) {
    throw new Error(`[system_config] 获取 migration 规则返回格式错误`);
  }
  const migrationRules = {};
  for (const r of json.data) {
    if (r.is_active) {
      migrationRules[r.name] = r.value;
    }
  }
  SYSTEM_CONFIG_CACHE = { ...SYSTEM_CONFIG_CACHE, ...migrationRules };
  addLog('INFO', `[system_config] 已从服务端拉取 migration 规则`);
}

async function fetchSystemRulesFromServer() {
  const serverUrl = getServerUrl();
  addLog('INFO', `[system_config] 正在从 ${serverUrl} 拉取 system 规则...`);
  const response = await fetch(`${serverUrl}/api/system-config?category=system`);
  if (!response.ok) {
    throw new Error(`[system_config] 获取 system 规则失败: HTTP ${response.status} (${serverUrl})`);
  }
  const json = await response.json();
  if (!json.success || !Array.isArray(json.data)) {
    throw new Error(`[system_config] 获取 system 规则返回格式错误`);
  }
  const systemRules = {};
  for (const r of json.data) {
    if (r.is_active) {
      systemRules[r.name] = r.value;
    }
  }
  SYSTEM_CONFIG_CACHE = { ...SYSTEM_CONFIG_CACHE, ...systemRules };
  addLog('INFO', `[system_config] 已从服务端拉取 system 规则`);
}

function getCachedRule(name, fallback) {
  if (SYSTEM_CONFIG_CACHE[name] !== undefined) {
    return SYSTEM_CONFIG_CACHE[name];
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`[system_config] 规则 "${name}" 未在缓存中且无内置默认值，请确保服务端规则已成功加载`);
}

let LAUNCHER_CONFIG = { serverUrl: null, templateManifest: DEFAULT_TEMPLATE_MANIFEST };
try {
  const CONFIG_DIR = join(__dirname, '..', 'config'); // Assuming a config folder exists next to src
  const CONFIG_FILE = join(CONFIG_DIR, 'launcher_config.json'); // Use a specific name for launcher config

  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (existsSync(CONFIG_FILE)) {
    const loadedConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    LAUNCHER_CONFIG = { ...LAUNCHER_CONFIG, ...loadedConfig };
    // Ensure manifest falls back to defaults if partially defined
    LAUNCHER_CONFIG.templateManifest = {
      bundleDirs: loadedConfig.templateManifest?.bundleDirs || DEFAULT_TEMPLATE_MANIFEST.bundleDirs,
      normalizePaths: loadedConfig.templateManifest?.normalizePaths || DEFAULT_TEMPLATE_MANIFEST.normalizePaths
    };
  }
} catch (e) {
  // Ignore errors for now, will log later
}

function getServerUrl() {
  return LAUNCHER_CONFIG.serverUrl || process.env.OPENCLAW_SERVER_URL || 'http://134.175.18.139:3001';
}

function addLog(level, message, invitationId = null, deviceIdToUse = globalDeviceId) {
  const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '').trim();
  const logEntry = {
    timestamp: new Date().toISOString(),
    deviceId: deviceIdToUse,
    invitationId: invitationId,
    level,
    source: 'launcher',
    message: cleanMessage
  };
  installState.logs.push(logEntry);

  const serverUrl = getServerUrl();
  fetch(`${serverUrl}/api/launcher-logs/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: deviceIdToUse,
      logs: [logEntry]
    })
  }).catch(() => {});

  try {
    if (!existsSync(dirname(LAUNCHER_JSONL_LOG))) {
      mkdirSync(dirname(LAUNCHER_JSONL_LOG), { recursive: true });
    }
    appendFileSync(LAUNCHER_JSONL_LOG, JSON.stringify(logEntry) + '\n', 'utf-8');
  } catch (e) {}
}

function addTaggedLog(level, tag, message, templateId = null) {
  const taggedMessage = `${tag} ${message}`;
  const logEntry = {
    timestamp: new Date().toISOString(),
    deviceId: globalDeviceId,
    level,
    source: 'launcher',
    message: taggedMessage,
    tag,
    templateId
  };
  installState.logs.push(logEntry);

  const serverUrl = getServerUrl();
  fetch(`${serverUrl}/api/launcher-logs/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: globalDeviceId,
      logs: [logEntry]
    })
  }).catch(() => {});

  try {
    if (!existsSync(dirname(LAUNCHER_JSONL_LOG))) {
      mkdirSync(dirname(LAUNCHER_JSONL_LOG), { recursive: true });
    }
    appendFileSync(LAUNCHER_JSONL_LOG, JSON.stringify(logEntry) + '\n', 'utf-8');
  } catch (e) {}
}

function isOpenClawInstalled() {
  const now = Date.now();
  if (cachedInstallStatus !== null && (now - lastInstallCheckTime) < INSTALL_CHECK_CACHE_MS) {
    return cachedInstallStatus;
  }

  let foundPath = null;

  try {
    const result = execSync('openclaw --version 2>&1', { encoding: 'utf8', timeout: 8000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    if (result && !result.includes('not recognized') && !result.includes('not found') && !result.includes('command not found')) {
      if (cachedInstallStatus !== true) {
        addLog('INFO', `OpenClaw CLI 可用，版本: ${result.trim()}`);
      }
      cachedInstallStatus = true;
      lastInstallCheckTime = now;
      return true;
    }
  } catch (e) {
  }

  try {
    const result = execSync('npm list -g openclaw --depth=0 2>&1', { encoding: 'utf8', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    if (result && result.toLowerCase().includes('openclaw@')) {
      const match = result.match(/openclaw@(\S+)/);
      if (match) {
        if (cachedInstallStatus !== true) {
          addLog('INFO', `OpenClaw npm 包已安装，版本: ${match[1]}`);
        }
        cachedInstallStatus = true;
        lastInstallCheckTime = now;
        return true;
      }
    }
  } catch (e) {
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
    deviceId: globalDeviceId, // Add deviceId here
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

app.post('/gateway/start', async (req, res) => {
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

  // 先执行 openclaw setup --accept-defaults
  try {
    addLog('INFO', '执行 openclaw setup --accept-defaults...');
    execSync('openclaw setup --accept-defaults', { encoding: 'utf8', timeout: 30000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    addLog('INFO', 'openclaw setup 完成。');
  } catch (setupErr) {
    addLog('WARN', `openclaw setup 失败或超时 (可能已配置): ${setupErr.message}`);
  }

  function getOpenClawConfig() {
    if (existsSync(OPENCLAW_CONFIG_FILE)) {
      try {
        return JSON.parse(readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8'));
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  try {
    const openClawConfig = getOpenClawConfig();
    const gatewayToken = openClawConfig?.gateway?.auth?.token || '';

    const env = {
      ...process.env,
      HOME: homedir, // Ensure HOME is set for cross-platform compatibility
      USERPROFILE: homedir // Ensure USERPROFILE is set for Windows
    };
    if (gatewayToken) {
      env.OPENCLAW_GATEWAY_TOKEN = gatewayToken;
      addLog('INFO', '已从配置文件读取 Gateway Token，并设置环境变量。');
    }

    const gatewayProcess = spawn('openclaw', ['gateway', 'run', '--allow-unconfigured'], { // 添加 --allow-unconfigured 参数
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true,
      env: env // 传递环境变量
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
  let currentVersion = 'unknown';
  let latestVersion = 'unknown';
  let npmPath = null;
  let installed = false;

  try {
    const verResult = execSync('openclaw --version', { encoding: 'utf8', timeout: 10000, windowsHide: true });
    const ver = verResult.trim();
    if (ver && !ver.includes('not recognized') && !ver.includes('not found')) {
      currentVersion = ver;
      installed = true;
    }
  } catch (e) {
    try {
      const showResult = execSync('npm list openclaw -g --depth=0', { encoding: 'utf8', timeout: 10000, windowsHide: true });
      const match = showResult.match(/openclaw@(\S+)/);
      if (match) {
        currentVersion = match[1];
        installed = true;
      }
    } catch (e2) {
      const npmGlobalPath = join(process.env['APPDATA'] || '', 'npm');
      try {
        const pkgPath = join(npmGlobalPath, 'node_modules', 'openclaw', 'package.json');
        if (existsSync(pkgPath)) {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
          currentVersion = pkg.version || 'unknown';
          installed = true;
        }
      } catch (e3) {
      }
    }
  }

  if (!installed) {
    return res.json({ installed: false, message: '未检测到 OpenClaw 安装' });
  }

  try {
    const result = execSync('npm view openclaw version', { encoding: 'utf8', timeout: 10000, windowsHide: true });
    latestVersion = result.trim();
  } catch (e) {
  }

  const isLatest = currentVersion !== 'unknown' && currentVersion === latestVersion;

  return res.json({
    installed: true,
    npmPath,
    currentVersion,
    latestVersion,
    isLatest
  });
});

app.post('/install/start', async (req, res) => {
  if (installState.running) {
    return res.json({ success: false, message: '安装已在进行中' });
  }

  installState.running = true;
  installState.logs = [];
  addLog('INFO', '开始安装 OpenClaw...');
  res.json({ success: true });

  try {
    addLog('INFO', '执行 npm install -g openclaw...');
    const installProcess = spawn('npm', ['install', '-g', 'openclaw'], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      windowsHide: true
    });

    installState.process = installProcess;

    installProcess.stdout.on('data', (data) => {
      addLog('INFO', `[npm install stdout] ${data.toString().trim()}`);
    });

    installProcess.stderr.on('data', (data) => {
      addLog('WARN', `[npm install stderr] ${data.toString().trim()}`);
    });

    installProcess.on('close', (code) => {
      if (code === 0) {
        addLog('INFO', 'OpenClaw 安装完成！');
        cachedInstallStatus = null; // 清除缓存，强制重新检测
      } else {
        addLog('ERROR', `OpenClaw 安装失败，退出码: ${code}`);
      }
      installState.running = false;
      installState.process = null;
    });

    installProcess.on('error', (err) => {
      addLog('ERROR', `npm install 进程启动失败: ${err.message}`);
      installState.running = false;
      installState.process = null;
    });

  } catch (err) {
    addLog('ERROR', `启动安装失败: ${err.message}`);
    installState.running = false;
    installState.process = null;
  }
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
      keyPaths: {},
      fileContents: {}
    };

    if (existsSync(OPENCLAW_CONFIG_FILE)) {
      const stat = statSync(OPENCLAW_CONFIG_FILE);
      if (stat.size > 10 * 1024 * 1024) {
        return res.json({ success: false, error: '[GET /config/export] 配置文件过大: ' + stat.size + ' bytes，最大允许 10MB' });
      }
      result.config = JSON.parse(readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8'));
      result.source = 'openclaw';
    }

    if (existsSync(OPENCLAW_ENV_FILE)) {
      result.env = readFileSync(OPENCLAW_ENV_FILE, 'utf-8');
    }

    const keyDirs = ['agents', 'skills', 'canvas', 'logs', 'flows', 'subagents', 'tasks', 'memory', 'media'];
    const openclawDir = OPENCLAW_CONFIG_DIR;
    const configWorkspace = result.config?.agents?.defaults?.workspace || null;
    const agentWorkspaces = [];

    if (existsSync(openclawDir)) {
      try {
        const entries = readdirSync(openclawDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.startsWith('workspace-')) {
            agentWorkspaces.push(entry.name);
          }
        }
      } catch (e) {}
    }

    const workspaceItem = {
      path: join(openclawDir, 'workspace'),
      exists: existsSync(join(openclawDir, 'workspace')) || (configWorkspace ? existsSync(configWorkspace) : false),
      files: [],
      subDirs: [],
      agentWorkspaces: agentWorkspaces,
      configWorkspaceDir: configWorkspace
    };

    if (configWorkspace && existsSync(configWorkspace)) {
      try {
        const entries = readdirSync(configWorkspace, { withFileTypes: true });
        for (const entry of entries.slice(0, 10)) {
          if (entry.isDirectory()) {
            workspaceItem.subDirs.push(entry.name);
          } else {
            workspaceItem.files.push(entry.name);
          }
        }
      } catch (e) {}
    } else if (existsSync(join(openclawDir, 'workspace'))) {
      try {
        const entries = readdirSync(join(openclawDir, 'workspace'), { withFileTypes: true });
        for (const entry of entries.slice(0, 10)) {
          if (entry.isDirectory()) {
            workspaceItem.subDirs.push(entry.name);
          } else {
            workspaceItem.files.push(entry.name);
          }
        }
      } catch (e) {}
    }
    result.keyPaths['workspace'] = workspaceItem;

    // Read file contents for workspace and skills
    const filesToBundle = {};

    function readAndEncodeFiles(baseDir, relativePath = '') {
      if (!existsSync(baseDir)) return;
      const entries = readdirSync(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(baseDir, entry.name);
        const currentRelativePath = join(relativePath, entry.name);
        if (entry.isFile()) {
          try {
            const content = readFileSync(fullPath);
            filesToBundle[currentRelativePath] = content.toString('base64');
          } catch (e) {
            addLog('WARN', `无法读取或编码文件 ${fullPath}: ${e.message}`);
          }
        } else if (entry.isDirectory()) {
          readAndEncodeFiles(fullPath, currentRelativePath);
        }
      }
    }

    const workspacePath = join(openclawDir, 'workspace');
    const skillsPath = join(openclawDir, 'skills');

    readAndEncodeFiles(workspacePath, 'workspace');
    readAndEncodeFiles(skillsPath, 'skills');

    result.fileContents = filesToBundle; // fileContents is a top-level field

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

    if (result.config) {
      result.config = normalizeConfigPathsForExport(result.config, OPENCLAW_CONFIG_DIR);
    }

    res.json(result);
  } catch (err) {
    const msg = err.message ? String(err.message).substring(0, 500) : 'unknown';
    const stack = err.stack ? String(err.stack).substring(0, 1000) : '';
    res.json({ success: false, error: '[POST /config/export] ' + msg + (stack ? ' :: ' + stack : '') });
  }
});

app.post('/config/export', (req, res) => {
  try {
    const { manifestName } = req.body;
    const result = {
      success: true,
      config: null,
      env: null,
      source: 'default',
      configPath: OPENCLAW_CONFIG_FILE,
      envPath: OPENCLAW_ENV_FILE,
      manifestName: manifestName || null,
      fileContents: {}
    };

    if (existsSync(OPENCLAW_CONFIG_FILE)) {
      const stat = statSync(OPENCLAW_CONFIG_FILE);
      if (stat.size > 10 * 1024 * 1024) {
        return res.json({ success: false, error: '[POST /config/export] 配置文件过大: ' + stat.size + ' bytes，最大允许 10MB' });
      }
      result.config = JSON.parse(readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8'));
      result.source = 'openclaw';
    }

    if (existsSync(OPENCLAW_ENV_FILE)) {
      result.env = readFileSync(OPENCLAW_ENV_FILE, 'utf-8');
    }

    const filesToBundle = {};
    const cachedExcludedPatterns = getCachedRule('EXCLUDED_PATTERNS', excludedPatterns);
    const cachedDefaultExcludedDirs = getCachedRule('DEFAULT_EXCLUDED_DIRS', DEFAULT_EXCLUDED_DIRS);
    const allExcludedNames = new Set([...cachedExcludedPatterns, ...cachedDefaultExcludedDirs]);

    function readAndEncodeFilesFromDir(baseDir, relativePath = '') {
      if (!existsSync(baseDir)) return;
      const entries = readdirSync(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (allExcludedNames.has(entry.name)) continue;
        const fullPath = join(baseDir, entry.name);
        const currentRelativePath = join(relativePath, entry.name);
        if (entry.isFile()) {
          try {
            const stat = statSync(fullPath);
            if (stat.size > 5 * 1024 * 1024) {
              addTaggedLog('WARN', '[EXPORT]', `跳过过大文件: ${currentRelativePath} (${(stat.size/1024/1024).toFixed(1)}MB)`);
              continue;
            }
            const content = readFileSync(fullPath);
            filesToBundle[currentRelativePath] = content.toString('base64');
          } catch (e) {}
        } else if (entry.isDirectory()) {
          readAndEncodeFilesFromDir(fullPath, currentRelativePath);
        }
      }
    }

    if (manifestName) {
      const manifestPath = join(MANIFEST_DIR, `manifest_${manifestName}.json`);
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        const tm = manifest.templateManifest;
        if (tm && tm.categories) {
          for (const cat of tm.categories) {
            if (cat.paths && Array.isArray(cat.paths)) {
              for (const relPath of cat.paths) {
                const fullPath = join(OPENCLAW_CONFIG_DIR, relPath);
                readAndEncodeFilesFromDir(fullPath, relPath);
              }
            }
          }
        }
        addTaggedLog('INFO', '[EXPORT]', `基于Manifest[${manifestName}]导出: ${Object.keys(filesToBundle).length}个文件`);
      } else {
        addTaggedLog('WARN', '[EXPORT]', `Manifest[${manifestName}]不存在，使用默认导出`);
        readAndEncodeFilesFromDir(join(OPENCLAW_CONFIG_DIR, 'workspace'), 'workspace');
        readAndEncodeFilesFromDir(join(OPENCLAW_CONFIG_DIR, 'skills'), 'skills');
      }
    } else {
      readAndEncodeFilesFromDir(join(OPENCLAW_CONFIG_DIR, 'workspace'), 'workspace');
      readAndEncodeFilesFromDir(join(OPENCLAW_CONFIG_DIR, 'skills'), 'skills');
    }

    result.fileContents = filesToBundle;

    if (result.config) {
      result.config = normalizeConfigPathsForExport(result.config, OPENCLAW_CONFIG_DIR);
    }

    res.json(result);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Normalize paths for EXPORT (convert absolute paths to relative logical paths)
function normalizeConfigPathsForExport(config, configDir, normalizePaths) {
  if (!config) return config;
  const normalized = JSON.parse(JSON.stringify(config)); // Deep copy

  const cachedRules = getCachedRule('PATH_ADAPTATION_RULES', PATH_ADAPTATION_RULES);
  const pathFieldMap = normalizePaths || cachedRules.pathFieldMap || {
    'agents.defaults.workspace': 'workspace',
    'logging.file': 'logs/openclaw.log'
  };

  const isPathProblematic = (pathToCheck) => /^[a-zA-Z]:(\\|\/)/.test(pathToCheck) || (pathToCheck.startsWith('/') && process.platform === 'win32');

  for (const [dotPath, defaultRelativePath] of Object.entries(pathFieldMap)) {
    const parts = dotPath.split('.');
    let current = normalized;
    let found = true;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]]) {
        current = current[parts[i]];
      } else {
        found = false;
        break;
      }
    }

    if (found && current[parts[parts.length - 1]]) {
      const originalPath = current[parts[parts.length - 1]];
      if (!isPathProblematic(originalPath)) {
      } else {
        current[parts[parts.length - 1]] = defaultRelativePath;
        addLog('INFO', `导出模板：路径 [${dotPath}] 已从硬编码绝对路径 [${originalPath}] 归一化为相对逻辑路径 [${defaultRelativePath}]`);
      }
    }
  }
  return normalized;
}

// Hydrate paths for IMPORT (convert relative logical paths to absolute paths for the current machine)
function hydrateConfigPathsForImport(config, configDir, normalizePaths) {
  if (!config) return config;
  const hydrated = JSON.parse(JSON.stringify(config));

  const cachedRules = getCachedRule('PATH_ADAPTATION_RULES', PATH_ADAPTATION_RULES);
  const pathFieldMap = normalizePaths || cachedRules.pathFieldMap || {
    'agents.defaults.workspace': 'workspace',
    'logging.file': 'logs/openclaw.log'
  };

  const isPathProblematic = (pathToCheck) => /^[a-zA-Z]:(\\|\/)/.test(pathToCheck) || (pathToCheck.startsWith('/') && process.platform === 'win32');

  for (const [dotPath, defaultRelativePath] of Object.entries(pathFieldMap)) {
    const parts = dotPath.split('.');
    let current = hydrated;
    let found = true;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]]) {
        current = current[parts[i]];
      } else {
        found = false;
        break;
      }
    }
    
    if (found && current[parts[parts.length - 1]]) {
      const originalPath = current[parts[parts.length - 1]];
      let resolvedPath;
      
      if (isPathProblematic(originalPath)) {
          resolvedPath = join(configDir, defaultRelativePath);
          addLog('INFO', `导入模板：检测到硬编码绝对路径 [${originalPath}]，已强制水合为 [${resolvedPath}]`);
      } else {
          if (originalPath.startsWith(configDir)) {
              resolvedPath = originalPath;
          } else {
              resolvedPath = join(configDir, originalPath);
              addLog('INFO', `导入模板：将逻辑相对路径 [${originalPath}] 水合为当前机器绝对路径 [${resolvedPath}]`);
          }
      }
      current[parts[parts.length - 1]] = resolvedPath.replace(/\\/g, '/');
    }
  }

  if (hydrated.agents?.list && Array.isArray(hydrated.agents.list)) {
    for (const agent of hydrated.agents.list) {
      const agentWorkspaceRule = pathFieldMap['agents.list[].workspace'] || 'workspace-{agentId}';
      const agentDefaultWs = agent.id ? agentWorkspaceRule.replace('{agentId}', agent.id) : 'workspace';
      if (!agent.workspace && agent.id) {
        agent.workspace = join(configDir, agentDefaultWs).replace(/\\/g, '/');
        addLog('INFO', `导入模板：为 Agent [${agent.id}] 自动设置 workspace: ${agent.workspace}`);
      } else if (agent.workspace) {
        const originalPath = agent.workspace;
        if (isPathProblematic(originalPath)) {
          agent.workspace = join(configDir, agentDefaultWs).replace(/\\/g, '/');
          addLog('INFO', `导入模板：Agent [${agent.id}] 硬编码路径 [${originalPath}]，已水合为 [${agent.workspace}]`);
        } else if (!originalPath.startsWith(configDir)) {
          agent.workspace = join(configDir, originalPath).replace(/\\/g, '/');
          addLog('INFO', `导入模板：Agent [${agent.id}] 相对路径 [${originalPath}]，已水合为 [${agent.workspace}]`);
        }
      }
    }
  }

  return hydrated;
}

const PATH_ADAPTATION_RULES = {
  pathFields: ['workspace', 'agentDir', 'path', 'dir', 'logging.file'],
  sensitiveFields: ['apiKey', 'api_key', 'token', 'secret', 'password', 'privateKey'],
  keepExistingFields: ['models', 'agents'],
  mappings: {
    'workspace': { target: 'joinConfigDir', args: ['workspace'] },
    'logging.file': { target: 'joinConfigDir', args: ['logs', 'openclaw.log'] },
    '_default': { target: 'joinConfigDir' },
  },
};

function isPathField(key, rules) {
  const fields = rules?.pathFields || PATH_ADAPTATION_RULES.pathFields;
  return fields.includes(key);
}

function isSensitiveField(key, rules) {
  const fields = rules?.sensitiveFields || PATH_ADAPTATION_RULES.sensitiveFields;
  return fields.some(f => key.toLowerCase().includes(f.toLowerCase()));
}

function isKeepExistingField(key, rules) {
  const fields = rules?.keepExistingFields || PATH_ADAPTATION_RULES.keepExistingFields;
  return fields.includes(key);
}

function isAbsolutePathWithDriveLetter(path) {
  return /^[a-zA-Z]:\\/.test(path) || /^[a-zA-Z]:\//.test(path);
}

function isPathProblematic(pathToCheck) {
  return isAbsolutePathWithDriveLetter(pathToCheck) || (pathToCheck.startsWith('/') && process.platform === 'win32');
}

function resolvePathTarget(key, templatePath, rules) {
  const cachedRules = getCachedRule('PATH_ADAPTATION_RULES', PATH_ADAPTATION_RULES);
  const mappings = rules?.mappings || cachedRules.mappings;
  const mapping = mappings[key] || mappings['_default'];
  if (!mapping) return templatePath;

  const configDir = OPENCLAW_CONFIG_DIR;

  switch (mapping.target) {
    case 'joinConfigDir': {
      const subParts = mapping.args || [];
      if (subParts.length > 0) {
        return join(configDir, ...subParts);
      }
      if (templatePath && typeof templatePath === 'string') {
        const cleaned = templatePath.replace(/^[a-zA-Z]:(\\|\/)/, '').replace(/^\//, '');
        return join(configDir, cleaned);
      }
      return join(configDir);
    }
    case 'relative': {
      if (!templatePath || typeof templatePath !== 'string') return templatePath;
      return templatePath.replace(/^[a-zA-Z]:(\\|\/)/, '').replace(/^\//, '');
    }
    case 'absolute': {
      if (mapping.value) return mapping.value;
      return templatePath;
    }
    default:
      return templatePath;
  }
}

function adaptPath(templatePath, existingPath, key, rules) {
  if (!templatePath) return templatePath;
  const pathRules = rules || getCachedRule('PATH_ADAPTATION_RULES', PATH_ADAPTATION_RULES);

  if (isPathProblematic(templatePath)) {
    return resolvePathTarget(key, templatePath, pathRules);
  }

  if (isPathField(key, pathRules) && existingPath && existingPath !== templatePath && isPathProblematic(existingPath)) {
    return resolvePathTarget(key, existingPath, pathRules);
  }

  if (isPathField(key, pathRules) && existingPath && existingPath !== templatePath) {
    return existingPath;
  }

  return templatePath;
}

function mergeConfigRecursive(existing, template, conflicts = [], path = '', pathRules) {
  if (!template || typeof template !== 'object') {
    return template;
  }

  const rules = pathRules || getCachedRule('PATH_ADAPTATION_RULES', PATH_ADAPTATION_RULES);
  const result = Array.isArray(template) ? [...template] : { ...existing };

  for (const [key, templateValue] of Object.entries(template)) {
    const currentPath = path ? `${path}.${key}` : key;
    const existingValue = existing?.[key];

    if (existingValue === undefined || existingValue === null) {
      if (isPathField(key, rules) && typeof templateValue === 'string') {
        const adaptedPath = adaptPath(templateValue, null, key, rules);
        if (adaptedPath !== templateValue) {
          conflicts.push({ field: currentPath, action: 'adapted_path', from: templateValue, to: adaptedPath, reason: 'platform_adaptation' });
        }
        result[key] = adaptedPath;
      } else {
        result[key] = templateValue;
      }
      continue;
    }

    if (isSensitiveField(key, rules)) {
      if (existingValue && existingValue !== templateValue) {
        conflicts.push({ field: currentPath, action: 'kept_existing', reason: 'sensitive_data' });
        result[key] = existingValue;
      } else {
        result[key] = templateValue;
      }
      continue;
    }

    if (isPathField(key, rules) && typeof templateValue === 'string') {
      const shouldAdapt = isAbsolutePathWithDriveLetter(templateValue) || (templateValue.startsWith('/') && process.platform === 'win32');
      if (shouldAdapt || (existingValue && existingValue !== templateValue && isPathField(key, rules))) {
        const adaptedPath = adaptPath(templateValue, existingValue, key, rules);
        if (adaptedPath !== templateValue) {
          conflicts.push({ field: currentPath, action: 'adapted_path', from: templateValue, to: adaptedPath, reason: 'path_compatibility' });
          result[key] = adaptedPath;
        } else if (existingValue && existingValue !== templateValue) {
          conflicts.push({ field: currentPath, action: 'kept_existing', reason: 'user_maintained_config' });
          result[key] = existingValue;
        } else {
          result[key] = templateValue;
        }
      } else {
        result[key] = templateValue;
      }
      continue;
    }

    if (isKeepExistingField(key, rules)) {
      conflicts.push({ field: currentPath, action: 'kept_existing', reason: 'user_maintained_config' });
      result[key] = existingValue;
      continue;
    }

    if (typeof templateValue === 'object' && templateValue !== null && !Array.isArray(templateValue)) {
      result[key] = mergeConfigRecursive(existingValue, templateValue, conflicts, currentPath, rules);
    } else if (Array.isArray(templateValue)) {
      result[key] = templateValue;
    } else {
      if (existingValue !== templateValue && existingValue) {
        conflicts.push({ field: currentPath, action: 'overwritten', from: existingValue, to: templateValue });
      }
      result[key] = templateValue;
    }
  }

  return result;
}

// Function to load, adapt paths, and save the OpenClaw config
async function loadAndAdaptConfig() {
  if (!existsSync(OPENCLAW_CONFIG_FILE)) {
    addLog('INFO', '配置文件不存在，跳过预适配。');
    return;
  }

  try {
    const existingConfig = JSON.parse(readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8'));
    const conflicts = []; // Not interested in conflicts here, just adaptation

    // Recursively adapt paths in the existing config
    const adaptedConfig = mergeConfigRecursive(existingConfig, existingConfig, conflicts, '');

    // Check if any adaptation happened and save if needed
    if (JSON.stringify(adaptedConfig) !== JSON.stringify(existingConfig)) {
      writeFileSync(OPENCLAW_CONFIG_FILE, JSON.stringify(adaptedConfig, null, 2), 'utf-8');
      addLog('INFO', 'Gateway启动前：openclaw.json 路径已适配并保存。');
    } else {
      addLog('INFO', 'Gateway启动前：openclaw.json 路径无需适配。');
    }
  } catch (e) {
    addLog('ERROR', `Gateway启动前：适配 openclaw.json 路径失败: ${e.message}`);
  }
}



function getValueAtPath(obj, path) {
  const parts = path.split('.');
  for (const part of parts) {
    if (obj === null || typeof obj !== 'object') return undefined;
    obj = obj[part];
    if (obj === undefined) return undefined;
  }
  return obj;
}

function setValueAtPath(obj, path, value) {
  const parts = path.split('.');
  const last = parts[parts.length - 1];
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (obj[part] === null || typeof obj[part] !== 'object') {
      obj[part] = {};
    }
    obj = obj[part];
  }
  obj[last] = value;
}

function deleteValueAtPath(obj, path) {
  const parts = path.split('.');
  const last = parts[parts.length - 1];
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (obj === null || typeof obj !== 'object' || obj[part] === undefined) return false;
    obj = obj[part];
  }
  if (last in obj) { delete obj[last]; return true; }
  return false;
}

const BUILTIN_TRANSFORMS = {
  toLowerCase: v => typeof v === 'string' ? v.toLowerCase() : v,
  toUpperCase: v => typeof v === 'string' ? v.toUpperCase() : v,
  trim: v => typeof v === 'string' ? v.trim() : v,
  basename: v => typeof v === 'string' ? (v.split('/').pop().split('\\').pop()) : v,
  dirname: v => typeof v === 'string' ? (v.replace(/[/\\][^/\\]*$/, '')) : v,
  relativePath: (v, base) => typeof v === 'string' ? (base ? v.replace(base, '') : v) : v,
  joinConfigDir: v => typeof v === 'string' ? join(OPENCLAW_CONFIG_DIR, v) : v,
  arrayUnique: v => Array.isArray(v) ? [...new Set(v)] : v,
  arrayFilterEmpty: v => Array.isArray(v) ? v.filter(i => i !== null && i !== undefined && i !== '') : v,
};

function applyTransform(value, fn, args = []) {
  const fnMap = BUILTIN_TRANSFORMS;
  if (typeof fnMap[fn] === 'function') {
    return fnMap[fn](value, ...args);
  }
  return value;
}

function applyRuleOp(obj, path, rule) {
  if (rule === null || rule === undefined) {
    return deleteValueAtPath(obj, path) ? 'deleted' : 'noop';
  }
  if (typeof rule !== 'object') return 'noop';

  const op = rule.op;
  if (!op) {
    if (rule === null) return deleteValueAtPath(obj, path) ? 'deleted' : 'noop';
    return 'noop';
  }

  switch (op) {
    case 'delete': {
      if ('ifValue' in rule) {
        const current = getValueAtPath(obj, path);
        if (current !== rule.ifValue) return 'noop';
      }
      return deleteValueAtPath(obj, path) ? 'deleted' : 'noop';
    }

    case 'rename': {
      const to = rule.to;
      if (!to || typeof to !== 'string') return 'noop';
      const parts = path.split('.');
      const last = parts[parts.length - 1];
      let parent = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        if (parent === null || typeof parent !== 'object') return 'noop';
        parent = parent[parts[i]];
      }
      if (parent === null || typeof parent !== 'object' || !(last in parent)) return 'noop';
      parent[to] = parent[last];
      delete parent[last];
      return 'renamed';
    }

    case 'move': {
      const to = rule.to;
      if (!to || typeof to !== 'string') return 'noop';
      const val = getValueAtPath(obj, path);
      if (val === undefined) return 'noop';
      deleteValueAtPath(obj, path);
      setValueAtPath(obj, to, val);
      return 'moved';
    }

    case 'value': {
      if ('value' in rule) {
        setValueAtPath(obj, path, rule.value);
        return 'set';
      }
      return 'noop';
    }

    case 'default': {
      const current = getValueAtPath(obj, path);
      if (current === undefined) {
        setValueAtPath(obj, path, rule.value);
        return 'defaulted';
      }
      return 'noop';
    }

    case 'copy': {
      const from = rule.from;
      if (!from || typeof from !== 'string') return 'noop';
      const val = getValueAtPath(obj, from);
      if (val === undefined) return 'noop';
      setValueAtPath(obj, path, JSON.parse(JSON.stringify(val)));
      return 'copied';
    }

    case 'transform': {
      const fn = rule.fn;
      if (!fn || typeof fn !== 'string') return 'noop';
      const val = getValueAtPath(obj, path);
      const transformed = applyTransform(val, fn, rule.args || []);
      setValueAtPath(obj, path, transformed);
      return 'transformed';
    }

    case 'backup': {
      const to = rule.to;
      if (!to || typeof to !== 'string') return 'noop';
      const val = getValueAtPath(obj, path);
      if (val === undefined) return 'noop';
      if (getValueAtPath(obj, to) === undefined) {
        setValueAtPath(obj, to, JSON.parse(JSON.stringify(val)));
        return 'backup';
      }
      return 'noop';
    }

    case 'restore': {
      const from = rule.from;
      if (!from || typeof from !== 'string') return 'noop';
      const val = getValueAtPath(obj, from);
      if (val === undefined) return 'noop';
      setValueAtPath(obj, path, JSON.parse(JSON.stringify(val)));
      deleteValueAtPath(obj, from);
      return 'restored';
    }

    default:
      return 'noop';
  }
}

function applyRules(content, rules) {
  if (!rules || !content) return content;
  if (typeof content !== 'object' || content === null) return content;
  const result = JSON.parse(JSON.stringify(content));
  let changed = false;

  if (Array.isArray(rules.removeProvidersWithoutModels)) {
    const provPath = result.models?.providers;
    if (provPath && typeof provPath === 'object') {
      for (const provId of rules.removeProvidersWithoutModels) {
        const prov = provPath[provId];
        if (prov && typeof prov === 'object' && (!Array.isArray(prov.models) || prov.models.length === 0)) {
          delete provPath[provId];
          changed = true;
        }
      }
    }
  }

  const ruleMap = rules.rules || rules;
  if (typeof ruleMap === 'object' && ruleMap !== null) {
    for (const [path, rule] of Object.entries(ruleMap)) {
      if (path === 'removeProvidersWithoutModels') continue;
      if (path.includes('*')) {
        const expanded = expandWildcardPaths(result, path);
        for (const realPath of expanded) {
          applyRuleOp(result, realPath, rule);
        }
      } else {
        applyRuleOp(result, path, rule);
      }
    }
  }

  return result;
}

function expandWildcardPaths(obj, path) {
  const parts = path.split('.');
  const results = [];

  function walk(current, prefix, partIndex) {
    if (partIndex >= parts.length) {
      results.push(prefix);
      return;
    }
    const part = parts[partIndex];
    if (part === '*') {
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        for (const key of Object.keys(current)) {
          walk(current[key], prefix ? `${prefix}.${key}` : key, partIndex + 1);
        }
      }
    } else {
      if (current && typeof current === 'object') {
        walk(current[part], prefix ? `${prefix}.${part}` : part, partIndex + 1);
      }
    }
  }

  walk(obj, '', 0);
  return results;
}

function migrateContent(content, migration, pathHint) {
  if (!content || typeof content !== 'object') return content;
  if (!migration) return content;

  const rules = migration.rules || migration;
  if (!rules || typeof rules !== 'object') return content;

  const result = applyRules(content, rules);

  if (result !== content) {
    addLog('INFO', `[migrateContent] 文件迁移完成 (${pathHint || 'unknown'})`);
  }
  return result;
}

function sanitizeConfig(config, migration) {
  return migrateContent(config, migration, 'openclaw.json');
}

const PROXY_RULES = {
  providers: ['volcengine', 'openai', 'anthropic', 'google'],
  enable: {
    openclawJson: {
      'models.useProxy': { op: 'value', value: true },
    },
    providerOps: [
      { path: 'baseUrl', backupTo: '_originalBaseUrl' },
      { path: 'apiKey', backupTo: '_originalApiKey' },
      { path: 'baseUrl', op: 'value', value: '{{serverUrl}}/api/proxy/{{providerName}}' },
      { path: 'apiKey', op: 'value', value: '{{userToken}}' },
      { path: 'api', op: 'value', value: 'openai-completions' },
    ],
    authProfiles: {
      'profiles': { op: 'backup', to: '_originalProfiles' },
    },
    authProfileKey: {
      op: 'value',
      value: '{{userToken}}',
    },
    agentModels: {
      'providers': { op: 'backup', to: '_originalProviders' },
    },
  },
  disable: {
    openclawJson: {
      'models.useProxy': null,
    },
    providerOps: [
      { path: 'baseUrl', restoreFrom: '_originalBaseUrl' },
      { path: 'apiKey', restoreFrom: '_originalApiKey' },
      { path: '_originalBaseUrl', op: 'delete' },
      { path: '_originalApiKey', op: 'delete' },
      { path: 'api', op: 'delete', ifValue: 'openai-completions' },
    ],
    removeEmptyProviders: true,
    authProfiles: {
      'profiles': { op: 'restore', from: '_originalProfiles' },
      '_originalProfiles': null,
    },
    agentModels: {
      'providers': { op: 'restore', from: '_originalProviders' },
      '_originalProviders': null,
    },
  },
};

function resolveTemplate(str, vars) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] !== undefined ? vars[key] : '');
}

function applyProxyRules(config, rules, vars, fileHint) {
  if (!config || typeof config !== 'object') return config;
  const result = JSON.parse(JSON.stringify(config));

  const openclawJsonRules = rules.openclawJson;
  if (openclawJsonRules && typeof openclawJsonRules === 'object') {
    for (const [path, rule] of Object.entries(openclawJsonRules)) {
      const resolvedRule = JSON.parse(JSON.stringify(rule), (key, val) => {
        if (typeof val === 'string') return resolveTemplate(val, vars);
        return val;
      });
      applyRuleOp(result, path, resolvedRule);
    }
  }

  const providerOps = rules.providerOps;
  if (Array.isArray(providerOps) && result.models?.providers) {
    for (const providerName of vars._providers) {
      const provider = result.models.providers[providerName];
      if (!provider) continue;
      for (const opDef of providerOps) {
        const resolvedOp = JSON.parse(JSON.stringify(opDef), (key, val) => {
          if (typeof val === 'string') return resolveTemplate(val, { ...vars, providerName });
          return val;
        });
        if (resolvedOp.backupTo) {
          const val = provider[resolvedOp.path];
          if (val !== undefined && provider[resolvedOp.backupTo] === undefined) {
            provider[resolvedOp.backupTo] = JSON.parse(JSON.stringify(val));
          }
        } else if (resolvedOp.restoreFrom) {
          const val = provider[resolvedOp.restoreFrom];
          if (val !== undefined) {
            provider[resolvedOp.path] = val;
          }
        } else if (resolvedOp.ifValue !== undefined) {
          if (provider[resolvedOp.path] === resolvedOp.ifValue) {
            delete provider[resolvedOp.path];
          }
        } else if (resolvedOp.op) {
          const resolvedRule = { op: resolvedOp.op };
          if ('value' in resolvedOp) resolvedRule.value = resolvedOp.value;
          applyRuleOp(provider, resolvedOp.path, resolvedRule);
        } else if (resolvedOp[Object.keys(resolvedOp)[0]] === null) {
          const targetPath = Object.keys(resolvedOp)[0];
          deleteValueAtPath(provider, targetPath);
        }
      }
    }
  }

  if (rules.removeEmptyProviders && result.models?.providers) {
    const toRemove = [];
    for (const [name, prov] of Object.entries(result.models.providers)) {
      if (prov && typeof prov === 'object') {
        const remaining = Object.keys(prov).filter(k => prov[k] !== undefined && prov[k] !== null && prov[k] !== '');
        if (remaining.length === 0) toRemove.push(name);
      }
    }
    for (const id of toRemove) {
      delete result.models.providers[id];
      addLog('INFO', `[proxy] 删除空壳 provider: ${id}`);
    }
  }

  return result;
}

function applyAuthProfilesRules(authData, rules, vars, providerNames) {
  if (!authData || typeof authData !== 'object') return authData;
  const result = JSON.parse(JSON.stringify(authData));

  const authRules = rules.authProfiles;
  if (authRules && typeof authRules === 'object') {
    for (const [path, rule] of Object.entries(authRules)) {
      applyRuleOp(result, path, rule);
    }
  }

  if (rules.authProfileKey && result.profiles) {
    const keyRule = rules.authProfileKey;
    for (const providerName of providerNames) {
      const profileKey = `${providerName}:default`;
      if (result.profiles[profileKey]) {
        if (keyRule.op === 'value') {
          result.profiles[profileKey].key = resolveTemplate(String(keyRule.value), vars);
          result.profiles[profileKey].type = 'api_key';
        }
      }
    }
  }

  return result;
}

function applyAgentModelsRules(modelsData, rules, vars, providerNames) {
  if (!modelsData || typeof modelsData !== 'object') return modelsData;
  const result = JSON.parse(JSON.stringify(modelsData));

  const modelRules = rules.agentModels;
  if (modelRules && typeof modelRules === 'object') {
    for (const [path, rule] of Object.entries(modelRules)) {
      applyRuleOp(result, path, rule);
    }
  }

  if (rules.providerOps && result.providers) {
    for (const providerName of providerNames) {
      const provider = result.providers[providerName];
      if (!provider) continue;
      for (const opDef of rules.providerOps) {
        if (opDef.backupTo) {
          const val = provider[opDef.path];
          if (val !== undefined && provider[opDef.backupTo] === undefined) {
            provider[opDef.backupTo] = JSON.parse(JSON.stringify(val));
          }
        } else if (opDef.restoreFrom) {
          const val = provider[opDef.restoreFrom];
          if (val !== undefined) {
            provider[opDef.path] = val;
          }
        } else if (opDef.op === 'value' && opDef.path) {
          provider[opDef.path] = resolveTemplate(String(opDef.value), { ...vars, providerName });
        } else if (opDef.op === 'delete') {
          delete provider[opDef.path];
        }
      }
    }
  }

  return result;
}

app.post('/config/import', (req, res) => {
  try {
    addLog('INFO', '========== 开始应用模板配置 ==========');
    const { config, env, mergeStrategy, fileContents, applyOptions, configMigration } = req.body;
    const pathRules = configMigration?.pathAdaptation || getCachedRule('PATH_ADAPTATION_RULES', PATH_ADAPTATION_RULES);

    // Determine which directories to actually write based on applyOptions
    // If not provided, fallback to the full list defined in the manifest
    const allowedDirsToWrite = applyOptions?.dirs || LAUNCHER_CONFIG.templateManifest.bundleDirs;
    addLog('INFO', `导入模板：允许覆盖的目录选项 = [${allowedDirsToWrite.join(', ')}]`);

    if (!config) {
      addLog('ERROR', '配置应用失败：配置文件为空');
      return res.json({ success: false, error: '配置文件为空' });
    }

    addLog('INFO', `接收到配置项个数: ${Object.keys(config).length}`);
    const sanitizedConfig = sanitizeConfig(config, configMigration);

    if (!existsSync(OPENCLAW_CONFIG_DIR)) {
      mkdirSync(OPENCLAW_CONFIG_DIR, { recursive: true });
      addLog('INFO', `创建OpenClaw配置目录: ${OPENCLAW_CONFIG_DIR}`);
    }

    let finalConfig = sanitizedConfig;
    let conflicts = [];

    if (existsSync(OPENCLAW_CONFIG_FILE)) {
      try {
        addLog('INFO', '发现现有配置文件，正在合并...');
        const existingConfig = JSON.parse(readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8'));
        
        if (mergeStrategy === 'force') {
          finalConfig = sanitizedConfig;
          conflicts.push({ field: 'root', action: 'force_replaced', reason: 'force_mode' });
          addLog('WARN', '采用强制覆盖模式 (force merge)');
        } else {
          finalConfig = mergeConfigRecursive(existingConfig, sanitizedConfig, conflicts, '', pathRules);
          addLog('INFO', `合并完成，检测到 ${conflicts.length} 处冲突/调整`);
        }
      } catch (e) {
        conflicts.push({ field: 'root', action: 'parse_error', error: e.message });
        addLog('ERROR', `合并配置时发生错误: ${e.message}`);
      }
    } else {
      addLog('INFO', '未发现现有配置，直接写入新配置');
    }

    if (applyOptions?.configPaths !== false) {
      finalConfig = hydrateConfigPathsForImport(finalConfig, OPENCLAW_CONFIG_DIR);
    } else {
      addLog('INFO', `导入模板：依据用户选项，跳过路径配置的覆盖与水合`);
    }

    if (!finalConfig.gateway) finalConfig.gateway = {};
    if (!finalConfig.gateway.auth) finalConfig.gateway.auth = {};
    if (finalConfig.gateway.auth.mode === 'none' || !finalConfig.gateway.auth.mode) {
      finalConfig.gateway.auth.mode = 'token';
      if (!finalConfig.gateway.auth.token) {
        finalConfig.gateway.auth.token = crypto.randomBytes(24).toString('hex');
      }
      addLog('INFO', `导入模板：gateway.auth.mode 已设置为 token 模式（正常认证）`);
    }

    writeFileSync(OPENCLAW_CONFIG_FILE, JSON.stringify(finalConfig, null, 2), 'utf-8');
    if (env) {
      writeFileSync(OPENCLAW_ENV_FILE, env, 'utf-8');
      addLog('INFO', '已同时写入环境变量文件 (.env)');
    }
    addLog('INFO', `配置已成功应用并保存至: ${OPENCLAW_CONFIG_FILE}`);

    // Handle fileContents
    if (fileContents && typeof fileContents === 'object') {
      let filesWritten = 0;
      let filesSkipped = 0;
      for (const [relativeFilePath, base64Content] of Object.entries(fileContents)) {
        try {
          // Identify the top-level directory of this file (e.g., "skills" from "skills/my-skill/main.js")
          const pathParts = relativeFilePath.split(/\\|\//);
          const topLevelDir = pathParts[0];

          // Check if this directory is in the allowed list from the frontend options
          if (!allowedDirsToWrite.includes(topLevelDir)) {
              filesSkipped++;
              continue; // Skip writing this file
          }

          const cleanedRelativeFilePath = relativeFilePath.replace(/^[a-zA-Z]:(\\|\/)/, '').replace(/^\//, '');
          let targetPath = join(OPENCLAW_CONFIG_DIR, cleanedRelativeFilePath);

          // Security check: prevent path traversal
          if (!targetPath.startsWith(OPENCLAW_CONFIG_DIR)) {
              addLog('WARN', `拦截恶意路径穿越尝试: ${relativeFilePath}`);
              continue;
          }

          const targetDir = dirname(targetPath);
          if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
          }
          const content = Buffer.from(base64Content, 'base64');
          writeFileSync(targetPath, content);
          filesWritten++;
        } catch (e) {
          addLog('ERROR', `无法写入文件 ${relativeFilePath}: ${e.message}`);
        }
      }
      addLog('INFO', `文件同步完成：成功写入 ${filesWritten} 个文件，因选项跳过 ${filesSkipped} 个文件`);
    }

    res.json({ success: true, conflicts, merged: finalConfig });
  } catch (err) {
    addLog('ERROR', `配置应用过程中发生严重错误: ${err.message}`);
    res.json({ success: false, error: err.message });
  }
});

app.post('/config/sanitize', (req, res) => {
  try {
    if (!existsSync(OPENCLAW_CONFIG_FILE)) {
      return res.json({ success: false, error: '配置文件不存在' });
    }
    const rawConfig = JSON.parse(readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8'));
    const cleaned = sanitizeConfig(rawConfig);
    const removedKeys = [];

    addLog('INFO', `[sanitize] 原始配置 keys: ${Object.keys(rawConfig).join(', ')}`);
     if (rawConfig.models?.providers) {
       console.log(`[sanitize] 原始 providers: ${JSON.stringify(Object.keys(rawConfig.models.providers))}`);
     }
     if (cleaned.models?.providers) {
       console.log(`[sanitize] 清理后 providers: ${JSON.stringify(Object.keys(cleaned.models.providers))}`);
     } else {
       console.log(`[sanitize] 清理后 providers: ${cleaned.models?.providers}`);
     }

    function findRemoved(orig, clean, prefix = '') {
      for (const key of Object.keys(orig)) {
        if (!(key in clean)) {
          removedKeys.push(prefix ? `${prefix}.${key}` : key);
        } else if (typeof orig[key] === 'object' && orig[key] !== null && typeof clean[key] === 'object' && clean[key] !== null && !Array.isArray(orig[key])) {
          findRemoved(orig[key], clean[key], prefix ? `${prefix}.${key}` : key);
        }
      }
    }
    findRemoved(rawConfig, cleaned);

    if (removedKeys.length > 0) {
      writeFileSync(OPENCLAW_CONFIG_FILE, JSON.stringify(cleaned, null, 2), 'utf-8');
      addLog('INFO', `配置已清理，移除了 ${removedKeys.length} 个无效字段: ${removedKeys.join(', ')}`);
    } else {
      console.log('[sanitize] 未发现需要清理的字段');
    }

    console.log(`[sanitize] removedKeys: ${JSON.stringify(removedKeys)}`);
    res.json({ success: true, removedKeys, cleaned: removedKeys.length > 0 });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.get('/config/private-templates', (req, res) => {
  try {
    if (!existsSync(PRIVATE_TEMPLATE_DIR)) {
      return res.json({ success: true, templates: [] });
    }
    const files = readdirSync(PRIVATE_TEMPLATE_DIR).filter(f => f.endsWith('.json'));
    const templates = files.map(f => {
      const content = JSON.parse(readFileSync(join(PRIVATE_TEMPLATE_DIR, f), 'utf-8'));
      return { id: f.replace('.json', ''), ...content };
    }).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    res.json({ success: true, templates });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.get('/config/private-template/:id', (req, res) => {
  try {
    const filePath = join(PRIVATE_TEMPLATE_DIR, `${req.params.id}.json`);
    if (!existsSync(filePath)) {
      return res.json({ success: false, error: '模板不存在' });
    }
    const template = JSON.parse(readFileSync(filePath, 'utf-8'));
    res.json({ success: true, template });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/config/private-template', (req, res) => {
  try {
    const { config, env, label, description, configMigration } = req.body;
    if (!config) {
      return res.json({ success: false, error: '配置不能为空' });
    }

    if (!existsSync(PRIVATE_TEMPLATE_DIR)) {
      mkdirSync(PRIVATE_TEMPLATE_DIR, { recursive: true });
    }

    const templateId = `private_${Date.now()}`;
    const template = {
      label: label || '私有配置',
      description: description || '用户保存的私有配置',
      icon: '📁',
      category: '私有',
      config,
      configMigration: configMigration || null,
      env: env || null,
      savedAt: new Date().toISOString()
    };

    writeFileSync(join(PRIVATE_TEMPLATE_DIR, `${templateId}.json`), JSON.stringify(template, null, 2), 'utf-8');
    addLog('INFO', `私有模板已保存: ${template.label}`);
    res.json({ success: true, id: templateId });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.delete('/config/private-template/:id', (req, res) => {
  try {
    const filePath = join(PRIVATE_TEMPLATE_DIR, `${req.params.id}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      addLog('INFO', '私有模板已删除');
    }
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ===== Template System APIs =====

const excludedPatterns = ['.git', '.gitignore', '.gitattributes', 'node_modules', '.DS_Store', 'Thumbs.db', 'sessions', '.jsonl', '.deleted.', '.session', '.bak', '.bak.', '.clobbered.', '.fixed', '手动备份'];
const DEFAULT_EXCLUDED_DIRS = ['credentials', 'logs', 'bin', 'tools', 'private_templates', 'manifests', 'snapshots', 'apply_records'];
const FORCE_EXCLUDED_DIRS = ['credentials'];

function discoverCategories(stateDir, config, baseManifest) {
  addTaggedLog('INFO', '[DISCOVER]', `开始扫描状态目录: ${stateDir}`);

  const cachedDefaultExcludedDirs = getCachedRule('DEFAULT_EXCLUDED_DIRS', DEFAULT_EXCLUDED_DIRS);
  const cachedForceExcludedDirs = getCachedRule('FORCE_EXCLUDED_DIRS', FORCE_EXCLUDED_DIRS);
  const cachedDefaultManifest = getCachedRule('DEFAULT_TEMPLATE_MANIFEST', DEFAULT_TEMPLATE_MANIFEST);
  const cachedNormalizePaths = cachedDefaultManifest.normalizePaths || {};

  const excludedDirs = [...cachedDefaultExcludedDirs];
  const excludedSet = new Set(cachedForceExcludedDirs);
  if (baseManifest?.excludedDirs) {
    for (const d of baseManifest.excludedDirs) {
      if (!excludedDirs.includes(d)) excludedDirs.push(d);
    }
  }

  const categories = [];
  const normalizePaths = { ...cachedNormalizePaths };
  if (baseManifest?.normalizePaths) {
    Object.assign(normalizePaths, baseManifest.normalizePaths);
  }

  const agentsFound = [];
  const associatedDirs = new Set();

  if (config?.agents?.defaults?.workspace) {
    const wsValue = config.agents.defaults.workspace;
    const wsDir = wsValue.replace(/^[a-zA-Z]:(\\|\/)/, '').replace(/^\//, '').split(/\\|\//)[0] || 'workspace';
    categories.push({
      name: 'workspace',
      label: '默认工作区',
      source: 'discovered',
      discoveryHint: 'agents.defaults.workspace',
      paths: [wsDir]
    });
    associatedDirs.add(wsDir);
    addTaggedLog('INFO', '[DISCOVER]', `读取 agents.defaults.workspace = "${wsValue}" → 识别默认工作区`);
  }

  if (config?.agents?.list && Array.isArray(config.agents.list)) {
    for (let i = 0; i < config.agents.list.length; i++) {
      const agent = config.agents.list[i];
      if (agent.id) {
        agentsFound.push(agent.id);
        const agentWsValue = agent.workspace || `workspace-${agent.id}`;
        const agentWsDir = agentWsValue.replace(/^[a-zA-Z]:(\\|\/)/, '').replace(/^\//, '').split(/\\|\//)[0] || `workspace-${agent.id}`;
        const agentDir = `agents/${agent.id}`;
        categories.push({
          name: `agent-${agent.id}`,
          label: `Agent: ${agent.id}`,
          source: 'discovered',
          discoveryHint: `agents.list[?id=='${agent.id}']`,
          paths: [agentWsDir, agentDir]
        });
        associatedDirs.add(agentWsDir);
        associatedDirs.add(agentDir);
        addTaggedLog('INFO', '[DISCOVER]', `读取 agents.list[${i}].id = "${agent.id}", workspace = "${agentWsValue}" → 识别 Agent 分类`);
      }
    }
  }

  if (existsSync(join(stateDir, 'skills'))) {
    categories.push({
      name: 'shared-skills',
      label: '共享技能库',
      source: 'discovered',
      discoveryHint: 'skills/',
      paths: ['skills']
    });
    associatedDirs.add('skills');
    addTaggedLog('INFO', '[DISCOVER]', '检测到 skills/ 目录 → 识别共享技能分类');
  }

  let totalDirs = 0;
  if (existsSync(stateDir)) {
    try {
      const entries = readdirSync(stateDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          totalDirs++;
          if (!excludedDirs.includes(entry.name) && !excludedSet.has(entry.name) && !associatedDirs.has(entry.name)) {
            categories.push({
              name: entry.name,
              label: `自定义目录: ${entry.name}`,
              source: 'discovered',
              paths: [entry.name]
            });
            addTaggedLog('INFO', '[DISCOVER]', `未关联目录: ${entry.name} → 创建独立分类`);
          }
        }
      }
    } catch (e) {
      addTaggedLog('ERROR', '[DISCOVER]', `扫描目录失败: ${e.message}`);
    }
  }

  if (baseManifest?.categories) {
    const discoveredNames = new Set(categories.map(c => c.name));
    for (const presetCat of baseManifest.categories) {
      if (!discoveredNames.has(presetCat.name)) {
        categories.push({
          ...presetCat,
          source: 'preset'
        });
        addTaggedLog('INFO', '[DISCOVER]', `预设中存在但未发现的分类: ${presetCat.name} → source=preset`);
      }
    }
  }

  addTaggedLog('INFO', '[DISCOVER]', `动态发现完成: 共 ${categories.length} 个分类, ${agentsFound.length} 个 Agent`);

  return {
    categories,
    normalizePaths,
    excludedDirs,
    scanInfo: {
      stateDir,
      totalDirs,
      excludedDirs: excludedDirs.length,
      discoveredDirs: categories.length,
      agentsFound
    }
  };
}

function redactFileContent(relativePath, rawContent) {
  const fileName = relativePath.split(/[/\\]/).pop();
  if (fileName !== 'auth-profiles.json' && fileName !== 'models.json') {
    return rawContent;
  }

  try {
    const json = JSON.parse(rawContent.toString('utf-8'));
    let modified = false;

    function redactRecursive(obj) {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string' && isSensitiveField(key) && obj[key].length > 0) {
          obj[key] = '';
          modified = true;
        } else if (typeof obj[key] === 'object') {
          redactRecursive(obj[key]);
        }
      }
    }

    redactRecursive(json);
    if (modified) {
      addTaggedLog('INFO', '[EXPORT]', `脱敏文件: ${relativePath}`);
      return Buffer.from(JSON.stringify(json, null, 2), 'utf-8');
    }
    return rawContent;
  } catch (e) {
    return rawContent;
  }
}

function bundleFiles(stateDir, categories, selectedCategories) {
  const fileContents = {};
  const fileList = {};
  const selectedSet = selectedCategories ? new Set(selectedCategories) : null;
  const cachedExcludedPatterns = getCachedRule('EXCLUDED_PATTERNS', excludedPatterns);
  const cachedDefaultExcludedDirs = getCachedRule('DEFAULT_EXCLUDED_DIRS', DEFAULT_EXCLUDED_DIRS);
  const allExcludedNames = new Set([...cachedExcludedPatterns, ...cachedDefaultExcludedDirs]);

  for (const cat of categories) {
    if (selectedSet && !selectedSet.has(cat.name)) continue;
    fileList[cat.name] = [];

    for (const relPath of cat.paths) {
      const fullPath = join(stateDir, relPath);
      if (!existsSync(fullPath)) continue;

      function readDirRecursive(baseDir, currentRelPath) {
        if (!existsSync(baseDir)) return;
        const entries = readdirSync(baseDir, { withFileTypes: true });
        for (const entry of entries) {
          if (allExcludedNames.has(entry.name)) continue;
          const entryFullPath = join(baseDir, entry.name);
          const entryRelPath = join(currentRelPath, entry.name);
          if (entry.isFile()) {
            try {
              const rawContent = readFileSync(entryFullPath);
              const content = redactFileContent(entryRelPath, rawContent);
              fileContents[entryRelPath] = content.toString('base64');
              fileList[cat.name].push(entryRelPath);
            } catch (e) {
              addTaggedLog('WARN', '[EXPORT]', `无法读取文件 ${entryRelPath}: ${e.message}`);
            }
          } else if (entry.isDirectory()) {
            readDirRecursive(entryFullPath, entryRelPath);
          }
        }
      }

      const stat = (() => { try { return statSync(fullPath); } catch { return null; } })();
      if (stat && stat.isFile()) {
        try {
          const rawContent = readFileSync(fullPath);
          const content = redactFileContent(relPath, rawContent);
          fileContents[relPath] = content.toString('base64');
          fileList[cat.name].push(relPath);
        } catch (e) {
          addTaggedLog('WARN', '[EXPORT]', `无法读取文件 ${relPath}: ${e.message}`);
        }
      } else if (stat && stat.isDirectory()) {
        readDirRecursive(fullPath, relPath);
      }
    }
  }

  return { fileContents, fileList };
}

function unbundleFiles(stateDir, fileContents, selectedCategories, manifest) {
  let filesWritten = 0;
  let filesSkipped = 0;
  const errors = [];
  const selectedPaths = new Set();

  if (manifest?.templateManifest?.categories) {
    for (const cat of manifest.templateManifest.categories) {
      if (selectedCategories.includes(cat.name)) {
        for (const p of cat.paths) {
          selectedPaths.add(p);
        }
      }
    }
  }

  for (const [relativePath, base64Content] of Object.entries(fileContents)) {
    const pathParts = relativePath.split(/\\|\//);
    const topLevelDir = pathParts[0];

    let shouldWrite = false;
    for (const sp of selectedPaths) {
      if (relativePath.startsWith(sp.replace(/\\/g, '/')) || relativePath.startsWith(sp.replace(/\//g, '\\'))) {
        shouldWrite = true;
        break;
      }
    }
    if (!shouldWrite && selectedPaths.has(topLevelDir)) {
      shouldWrite = true;
    }
    if (!shouldWrite) {
      filesSkipped++;
      continue;
    }

    const cleanedPath = relativePath.replace(/^[a-zA-Z]:(\\|\/)/, '').replace(/^\//, '');
    const targetPath = join(stateDir, cleanedPath);
    const resolvedPath = resolve(targetPath);

    if (!resolvedPath.startsWith(resolve(stateDir))) {
      addTaggedLog('ERROR', '[SECURITY]', `路径穿越检测 → 拒绝写入 ${relativePath} (解析为 ${resolvedPath}, 不在 ${stateDir} 内)`);
      errors.push(`路径穿越拦截: ${relativePath}`);
      continue;
    }

    try {
      const targetDir = dirname(targetPath);
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
        addTaggedLog('INFO', '[APPLY]', `创建目录: ${targetDir}`);
      }
      const content = Buffer.from(base64Content, 'base64');
      writeFileSync(targetPath, content);
      filesWritten++;
      addTaggedLog('INFO', '[APPLY]', `写入文件: ${relativePath} → ${targetPath} (${content.length} bytes)`);
    } catch (e) {
      addTaggedLog('ERROR', '[APPLY]', `写入失败: ${relativePath} → ${e.message}`);
      errors.push(`写入失败: ${relativePath}: ${e.message}`);
    }
  }

  return { filesWritten, filesSkipped, errors };
}

function createApplySnapshot(stateDir, templateId, templateName, selectedCategories, manifest, fileContents) {
  addTaggedLog('INFO', '[SNAPSHOT]', `开始创建快照: 模板 ${templateName}, 分类 [${selectedCategories.join(', ')}]`);

  const snapshotId = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19) + '-snapshot';
  const snapshot = {
    id: snapshotId,
    createdAt: new Date().toISOString(),
    templateId,
    templateName,
    selectedCategories,
    configSnapshot: null,
    fileContents: {},
    fileHashes: {},
    newFiles: []
  };

  if (existsSync(OPENCLAW_CONFIG_FILE)) {
    try {
      snapshot.configSnapshot = JSON.parse(readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8'));
      addTaggedLog('INFO', '[SNAPSHOT]', `快照配置: openclaw.json`);
    } catch (e) {
      addTaggedLog('WARN', '[SNAPSHOT]', `读取配置文件失败: ${e.message}`);
    }
  }

  const targetFiles = new Set();
  if (manifest?.templateManifest?.categories) {
    for (const cat of manifest.templateManifest.categories) {
      if (selectedCategories.includes(cat.name)) {
        for (const p of cat.paths) {
          const fullPath = join(stateDir, p);
          if (existsSync(fullPath)) {
            function collectFiles(dir, relBase) {
              const entries = readdirSync(dir, { withFileTypes: true });
              for (const entry of entries) {
                const fp = join(dir, entry.name);
                const rp = join(relBase, entry.name);
                if (entry.isFile()) {
                  targetFiles.add(rp);
                } else if (entry.isDirectory()) {
                  collectFiles(fp, rp);
                }
              }
            }
            const stat = (() => { try { return statSync(fullPath); } catch { return null; } })();
            if (stat && stat.isDirectory()) {
              collectFiles(fullPath, p);
            } else if (stat && stat.isFile()) {
              targetFiles.add(p);
            }
          }
        }
      }
    }
  }

  for (const relPath of targetFiles) {
    const absPath = join(stateDir, relPath);
    if (existsSync(absPath)) {
      try {
        const content = readFileSync(absPath);
        snapshot.fileContents[relPath] = content.toString('base64');
        snapshot.fileHashes[relPath] = crypto.createHash('sha256').update(content).digest('hex');
        addTaggedLog('INFO', '[SNAPSHOT]', `快照文件: ${relPath} (hash: ${snapshot.fileHashes[relPath].substring(0, 8)}...)`);
      } catch (e) {
        addTaggedLog('WARN', '[SNAPSHOT]', `无法快照文件 ${relPath}: ${e.message}`);
      }
    }
  }

  if (fileContents) {
    for (const relPath of Object.keys(fileContents)) {
      const pathParts = relPath.split(/\\|\//);
      let belongsToSelected = false;
      if (manifest?.templateManifest?.categories) {
        for (const cat of manifest.templateManifest.categories) {
          if (selectedCategories.includes(cat.name)) {
            for (const p of cat.paths) {
              if (relPath.startsWith(p.replace(/\\/g, '/')) || relPath.startsWith(p.replace(/\//g, '\\')) || pathParts[0] === p) {
                belongsToSelected = true;
                break;
              }
            }
          }
          if (belongsToSelected) break;
        }
      }
      if (belongsToSelected && !snapshot.fileContents[relPath]) {
        snapshot.newFiles.push(relPath);
        addTaggedLog('INFO', '[SNAPSHOT]', `新增文件标记 (无需备份): ${relPath}`);
      }
    }
  }

  if (!existsSync(SNAPSHOT_DIR)) {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }
  const snapshotPath = join(SNAPSHOT_DIR, `${snapshotId}.json`);
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  addTaggedLog('INFO', '[SNAPSHOT]', `快照完成: ${snapshotPath}, 备份 ${Object.keys(snapshot.fileContents).length} 个文件, 新增 ${snapshot.newFiles.length} 个文件`);

  return { snapshot, snapshotPath };
}

function rollbackFromSnapshot(stateDir, snapshotId) {
  addTaggedLog('INFO', '[ROLLBACK]', `开始回滚: 快照 ${snapshotId}`);

  const snapshotPath = join(SNAPSHOT_DIR, `${snapshotId}.json`);
  if (!existsSync(snapshotPath)) {
    return { success: false, error: '快照不存在' };
  }

  try {
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'));
    let restoredCount = 0;
    let deletedCount = 0;
    const errors = [];

    if (snapshot.configSnapshot) {
      writeFileSync(OPENCLAW_CONFIG_FILE, JSON.stringify(snapshot.configSnapshot, null, 2), 'utf-8');
      addTaggedLog('INFO', '[ROLLBACK]', '恢复配置: openclaw.json');
    }

    for (const [relPath, base64Content] of Object.entries(snapshot.fileContents)) {
      const absPath = join(stateDir, relPath);
      try {
        const content = Buffer.from(base64Content, 'base64');
        const targetDir = dirname(absPath);
        if (!existsSync(targetDir)) {
          mkdirSync(targetDir, { recursive: true });
        }
        writeFileSync(absPath, content);
        restoredCount++;
        addTaggedLog('INFO', '[ROLLBACK]', `恢复文件: ${relPath} → ${absPath}`);

        if (snapshot.fileHashes[relPath]) {
          const currentHash = crypto.createHash('sha256').update(content).digest('hex');
          if (currentHash !== snapshot.fileHashes[relPath]) {
            addTaggedLog('WARN', '[ROLLBACK]', `Hash 校验: ${relPath} mismatch`);
          } else {
            addTaggedLog('INFO', '[ROLLBACK]', `Hash 校验: ${relPath} match`);
          }
        }
      } catch (e) {
        errors.push(`恢复文件失败 ${relPath}: ${e.message}`);
        addTaggedLog('ERROR', '[ROLLBACK]', `恢复文件失败: ${relPath}: ${e.message}`);
      }
    }

    for (const relPath of snapshot.newFiles) {
      const absPath = join(stateDir, relPath);
      try {
        if (existsSync(absPath)) {
          unlinkSync(absPath);
          deletedCount++;
          addTaggedLog('INFO', '[ROLLBACK]', `删除新增文件: ${relPath}`);
        }
      } catch (e) {
        errors.push(`删除新增文件失败 ${relPath}: ${e.message}`);
        addTaggedLog('WARN', '[ROLLBACK]', `删除新增文件失败: ${relPath}: ${e.message}`);
      }
    }

    addTaggedLog('INFO', '[ROLLBACK]', `回滚完成: 恢复 ${restoredCount} 个文件, 删除 ${deletedCount} 个新增文件`);
    return { success: true, restoredCount, deletedCount, errors };
  } catch (e) {
    addTaggedLog('ERROR', '[ROLLBACK]', `回滚失败: ${e.message}`);
    return { success: false, error: e.message };
  }
}

function redactSensitiveFields(config) {
  if (!config || typeof config !== 'object') return config;
  const result = JSON.parse(JSON.stringify(config));
  const sensitiveKeys = ['apiKey', 'api_key', 'token', 'secret', 'password', 'privateKey', 'botToken', 'appToken'];

  function redactRecursive(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        if (obj[key] && typeof obj[key] === 'string' && obj[key].length > 0) {
          obj[key] = '';
        }
      } else if (typeof obj[key] === 'object') {
        redactRecursive(obj[key]);
      }
    }
  }

  redactRecursive(result);
  return result;
}

app.post('/template/discover', (req, res) => {
  try {
    const { baseManifest } = req.body;
    let config = null;

    if (existsSync(OPENCLAW_CONFIG_FILE)) {
      try {
        config = JSON.parse(readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8'));
      } catch (e) {
        addTaggedLog('ERROR', '[DISCOVER]', `配置文件解析失败: ${e.message}`);
      }
    }

    const discovered = discoverCategories(OPENCLAW_CONFIG_DIR, config, baseManifest);
    res.json({ success: true, discovered });
  } catch (err) {
    addTaggedLog('ERROR', '[DISCOVER]', `动态发现失败: ${err.message}`);
    res.json({ success: false, error: err.message });
  }
});

app.post('/template/manifest/save', (req, res) => {
  try {
    const { manifest } = req.body;
    if (!manifest?.templateManifest?.name) {
      return res.json({ success: false, error: 'Manifest 必须包含 templateManifest.name' });
    }

    const manifestName = manifest.templateManifest.name;
    if (!/^[a-zA-Z0-9_\-]+$/.test(manifestName)) {
      return res.json({ success: false, error: 'Manifest名称只能包含字母、数字、下划线和连字符，不能使用中文或特殊字符' });
    }

    if (!existsSync(MANIFEST_DIR)) {
      mkdirSync(MANIFEST_DIR, { recursive: true });
      addTaggedLog('INFO', '[CONFIG]', `Manifest目录创建: ${MANIFEST_DIR}`);
    }

    const manifestPath = join(MANIFEST_DIR, `manifest_${manifestName}.json`);
    console.log('[SAVE] Attempting to write:', manifestPath);
    console.log('[SAVE] File exists before:', existsSync(manifestPath));
    console.log('[SAVE] Dir writable:', (() => { try { writeFileSync(manifestPath + '.test', 'test'); unlinkSync(manifestPath + '.test'); return true; } catch { return false; } })());
    try {
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
      console.log('[SAVE] Write succeeded');
    } catch (writeErr) {
      console.log('[SAVE] Write failed:', writeErr.code, writeErr.message);
      if (writeErr.code === 'EPERM') {
        if (existsSync(manifestPath)) {
          const backupPath = manifestPath + `.bak.${Date.now()}`;
          try {
            renameSync(manifestPath, backupPath);
            console.log('[SAVE] File renamed to:', backupPath);
            addTaggedLog('WARN', '[CONFIG]', `Manifest文件被占用，重命名为: ${backupPath}`);
          } catch (renameErr) {
            console.log('[SAVE] Rename failed:', renameErr.message);
            addTaggedLog('ERROR', '[CONFIG]', `Manifest重命名失败: ${renameErr.message}`);
          }
          writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
          console.log('[SAVE] Write after rename succeeded');
        } else {
          console.log('[SAVE] EPERM on new file, no fallback available');
          addTaggedLog('ERROR', '[CONFIG]', `Manifest写入失败(EPERM): ${manifestPath} - ${writeErr.message}`);
          return res.json({ success: false, error: `文件写入失败: ${writeErr.message}` });
        }
      } else {
        throw writeErr;
      }
    }
    addTaggedLog('INFO', '[CONFIG]', `Manifest 已保存: ${manifestName}`);
    res.json({ success: true, savedTo: manifestPath });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.get('/template/manifests', (req, res) => {
  try {
    console.log('[DEBUG] GET /template/manifests called, MANIFEST_DIR:', MANIFEST_DIR);
    if (!existsSync(MANIFEST_DIR)) {
      console.log('[DEBUG] Dir not exists');
      return res.json({ success: true, manifests: [], debug: 'dir not exists' });
    }
    const allFiles = readdirSync(MANIFEST_DIR);
    const filteredFiles = allFiles.filter(f => f.startsWith('manifest_') && f.endsWith('.json'));
    console.log('[DEBUG] allFiles:', allFiles, 'filteredFiles:', filteredFiles);
    const manifests = filteredFiles.map(f => {
      try {
        const fullPath = join(MANIFEST_DIR, f);
        console.log('[DEBUG] Reading file:', fullPath);
        const content = JSON.parse(readFileSync(fullPath, 'utf-8'));
        const tm = content.templateManifest || {};
        const result = {
          name: tm.name || f.replace('manifest_', '').replace('.json', ''),
          isDefault: tm.isDefault || false,
          categoryCount: tm.categories?.length || 0,
          savedAt: statSync(fullPath).mtime.toISOString()
        };
        console.log('[DEBUG] File OK:', f, '->', result.name);
        return result;
      } catch (e) {
        console.log('[DEBUG] File error', f, ':', e.code, e.message);
        return null;
      }
    }).filter(Boolean);
    console.log('[DEBUG] manifests result:', manifests.length, 'items');
    res.json({ success: true, manifests, debug: { MANIFEST_DIR, allFiles, filteredFiles } });
  } catch (err) {
    console.log('[DEBUG] Outer error:', err.message);
    res.json({ success: false, error: err.message });
  }
});

app.get('/template/manifest/:name', (req, res) => {
  try {
    const manifestPath = join(MANIFEST_DIR, `manifest_${req.params.name}.json`);
    if (!existsSync(manifestPath)) {
      return res.json({ success: false, error: 'Manifest 不存在' });
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    res.json({ success: true, manifest });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.delete('/template/manifest/:name', (req, res) => {
  try {
    const manifestPath = join(MANIFEST_DIR, `manifest_${req.params.name}.json`);
    if (existsSync(manifestPath)) {
      unlinkSync(manifestPath);
      addTaggedLog('INFO', '[CONFIG]', `Manifest 已删除: ${req.params.name}`);
    }
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/template/export', (req, res) => {
  try {
    const { manifestName, categories } = req.body;
    let manifest = null;

    if (manifestName) {
      const manifestPath = join(MANIFEST_DIR, `manifest_${manifestName}.json`);
      if (existsSync(manifestPath)) {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      }
    } else if (categories && Array.isArray(categories)) {
      const cachedManifest = getCachedRule('DEFAULT_TEMPLATE_MANIFEST', DEFAULT_TEMPLATE_MANIFEST);
      manifest = {
        templateManifest: {
          name: 'temp-export',
          isDefault: false,
          categories,
          normalizePaths: cachedManifest.normalizePaths || {
            'agents.defaults.workspace': 'workspace',
            'agents.list[].workspace': 'workspace-{agentId}',
            'session.store': 'agents/{agentId}/sessions/sessions.json',
            'logging.file': 'logs/openclaw.log'
          },
          excludedDirs: cachedManifest.excludedDirs || ['credentials', 'logs', 'bin', 'tools', 'private_templates', 'manifests', 'snapshots', 'apply_records']
        }
      };
    }

    if (!manifest) {
      let config = null;
      if (existsSync(OPENCLAW_CONFIG_FILE)) {
        config = JSON.parse(readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8'));
      }
      const discovered = discoverCategories(OPENCLAW_CONFIG_DIR, config, null);
      manifest = {
        templateManifest: {
          name: 'auto-discovered',
          isDefault: false,
          categories: discovered.categories,
          normalizePaths: discovered.normalizePaths,
          excludedDirs: discovered.excludedDirs
        }
      };
    }

    const tm = manifest.templateManifest;
    let config = null;
    if (existsSync(OPENCLAW_CONFIG_FILE)) {
      config = JSON.parse(readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8'));
      config = normalizeConfigPathsForExport(config, OPENCLAW_CONFIG_DIR, tm.normalizePaths);
      config = redactSensitiveFields(config);
      addTaggedLog('INFO', '[EXPORT]', '配置已归一化并脱敏');
    }

    const { fileContents, fileList } = bundleFiles(OPENCLAW_CONFIG_DIR, tm.categories);
    addTaggedLog('INFO', '[EXPORT]', `模板导出完成: ${Object.keys(fileContents).length} 个文件, ${tm.categories.length} 个分类`);

    let env = null;
    if (existsSync(OPENCLAW_ENV_FILE)) {
      env = readFileSync(OPENCLAW_ENV_FILE, 'utf-8');
    }

    res.json({
      success: true,
      config,
      env,
      manifest,
      fileContents,
      fileList,
      exportInfo: {
        totalFiles: Object.keys(fileContents).length,
        totalSizeBytes: Object.values(fileContents).reduce((sum, b64) => sum + Math.ceil(b64.length * 0.75), 0),
        categories: tm.categories.map(c => c.name),
        normalizedPaths: Object.keys(tm.normalizePaths || {})
      }
    });
  } catch (err) {
    addTaggedLog('ERROR', '[EXPORT]', `模板导出失败: ${err.message}`);
    res.json({ success: false, error: err.message });
  }
});

app.post('/template/apply', async (req, res) => {
  try {
    const { templateId, selectedCategories, configPaths } = req.body;
    addTaggedLog('INFO', '[APPLY]', `开始应用模板: templateId=${templateId}, categories=[${selectedCategories?.join(', ')}]`, templateId);

    const serverUrl = getServerUrl();
    let templateData = null;
    try {
      const token = req.headers['x-server-token'] || '';
      const response = await fetch(`${serverUrl}/api/templates/${templateId}/full`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const result = await response.json();
      if (result.success && result.data) {
        templateData = result.data;
      } else {
        addTaggedLog('ERROR', '[APPLY]', `从服务端拉取模板失败: ${result.error || '未知错误'}`, templateId);
        return res.json({ success: false, error: `从服务端拉取模板失败: ${result.error || '未知错误'}` });
      }
    } catch (e) {
      addTaggedLog('ERROR', '[APPLY]', `从服务端拉取模板失败: ${e.message}`, templateId);
      return res.json({ success: false, error: `从服务端拉取模板失败: ${e.message}` });
    }

    const manifest = templateData.manifest;
    const fileContents = templateData.fileContents || templateData.filePayload || {};
    const templateConfig = templateData.config;
    const configMigration = templateData.configMigration;
    const pathRules = configMigration?.pathAdaptation || getCachedRule('PATH_ADAPTATION_RULES', PATH_ADAPTATION_RULES);

    const { snapshot, snapshotPath } = createApplySnapshot(
      OPENCLAW_CONFIG_DIR,
      templateId,
      templateData.name,
      selectedCategories || [],
      manifest,
      fileContents
    );

    let finalConfig = templateConfig;
    let configConflicts = [];

    if (templateConfig) {
      const sanitizedConfig = sanitizeConfig(templateConfig, configMigration);

      if (existsSync(OPENCLAW_CONFIG_FILE)) {
        try {
          const existingConfig = JSON.parse(readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8'));
          finalConfig = mergeConfigRecursive(existingConfig, sanitizedConfig, configConflicts, '', pathRules);
          addTaggedLog('INFO', '[APPLY]', `配置合并完成: ${configConflicts.length} 处冲突/调整`);
        } catch (e) {
          finalConfig = sanitizedConfig;
          addTaggedLog('WARN', '[APPLY]', `合并配置失败，使用模板配置: ${e.message}`);
        }
      }

      if (configPaths !== false) {
        finalConfig = hydrateConfigPathsForImport(finalConfig, OPENCLAW_CONFIG_DIR);
        addTaggedLog('INFO', '[APPLY]', `配置路径水合: configPaths=true`);
      } else {
        addTaggedLog('INFO', '[APPLY]', `路径水合跳过: 用户选择保留本地路径配置`);
      }

      if (!finalConfig.gateway) finalConfig.gateway = {};
      if (!finalConfig.gateway.auth) finalConfig.gateway.auth = {};
      if (finalConfig.gateway.auth.mode === 'none' || !finalConfig.gateway.auth.mode) {
        finalConfig.gateway.auth.mode = 'token';
        if (!finalConfig.gateway.auth.token) {
          finalConfig.gateway.auth.token = crypto.randomBytes(24).toString('hex');
        }
        addTaggedLog('INFO', '[APPLY]', `gateway.auth.mode 已设置为 token 模式（正常认证）`);
      }

      writeFileSync(OPENCLAW_CONFIG_FILE, JSON.stringify(finalConfig, null, 2), 'utf-8');
      addTaggedLog('INFO', '[APPLY]', `配置已写入: ${OPENCLAW_CONFIG_FILE}`);
    }

    const { filesWritten, filesSkipped, errors: unbundleErrors } = unbundleFiles(
      OPENCLAW_CONFIG_DIR,
      fileContents,
      selectedCategories || [],
      manifest
    );

    addTaggedLog('INFO', '[APPLY]', `文件写入完成: 成功 ${filesWritten} 个, 跳过 ${filesSkipped} 个, 失败 ${unbundleErrors.length} 个`);

    try {
      const configForSync = JSON.parse(readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8'));
      let modelsSynced = false;

      if (configForSync.agents?.list && Array.isArray(configForSync.agents.list)) {
        for (const agent of configForSync.agents.list) {
          if (!agent.id) continue;
          const agentModelsPath = join(OPENCLAW_CONFIG_DIR, 'agents', agent.id, 'agent', 'models.json');
          if (!existsSync(agentModelsPath)) continue;

          try {
            const agentModelsData = JSON.parse(readFileSync(agentModelsPath, 'utf-8'));
            if (!agentModelsData.providers) continue;

            if (!configForSync.models) configForSync.models = {};
            if (!configForSync.models.providers) configForSync.models.providers = {};

            for (const [providerName, providerValue] of Object.entries(agentModelsData.providers)) {
              if (!configForSync.models.providers[providerName]) {
                const copy = JSON.parse(JSON.stringify(providerValue));
                delete copy.apiKey;
                configForSync.models.providers[providerName] = copy;
                modelsSynced = true;
                addTaggedLog('INFO', '[APPLY]', `从 Agent [${agent.id}] models.json 同步 provider: ${providerName}（不含 apiKey）`);
              }
            }
          } catch (e) {
            addTaggedLog('WARN', `[APPLY] Agent [${agent.id}] models.json 读取失败: ${e.message}`);
          }
        }
      }

      if (modelsSynced) {
        writeFileSync(OPENCLAW_CONFIG_FILE, JSON.stringify(configForSync, null, 2), 'utf-8');
        addTaggedLog('INFO', '[APPLY]', 'models.providers 已从 Agent 级别同步到 openclaw.json');
      }
    } catch (syncErr) {
      addTaggedLog('WARN', `[APPLY] models.providers 同步失败（非致命）: ${syncErr.message}`);
    }

    try {
      addTaggedLog('INFO', '[APPLY]', '执行 openclaw doctor --repair 自动修复...');
      const doctorOutput = execSync('openclaw doctor --repair --non-interactive', {
        encoding: 'utf8',
        timeout: 60000,
        windowsHide: true,
        env: { ...process.env, HOME: homedir, USERPROFILE: homedir }
      });
      addTaggedLog('INFO', '[APPLY]', `doctor 修复完成: ${doctorOutput.substring(0, 500)}`);
    } catch (doctorErr) {
      addTaggedLog('WARN', '[APPLY]', `doctor 修复失败（非致命）: ${doctorErr.message?.substring(0, 200)}`);
    }

    try {
      addTaggedLog('INFO', '[APPLY]', '执行 openclaw setup 初始化 workspace...');
      execSync('openclaw setup', {
        encoding: 'utf8',
        timeout: 30000,
        windowsHide: true,
        env: { ...process.env, HOME: homedir, USERPROFILE: homedir }
      });
      addTaggedLog('INFO', '[APPLY]', 'workspace 初始化完成');
    } catch (setupErr) {
      addTaggedLog('WARN', '[APPLY]', `setup 初始化失败（非致命）: ${setupErr.message?.substring(0, 200)}`);
    }

    try {
      addTaggedLog('INFO', '[APPLY]', '执行 openclaw gateway restart 使认证配置生效...');
      execSync('openclaw gateway restart', {
        encoding: 'utf8',
        timeout: 30000,
        windowsHide: true,
        env: { ...process.env, HOME: homedir, USERPROFILE: homedir }
      });
      addTaggedLog('INFO', '[APPLY]', 'gateway 重启完成');
    } catch (restartErr) {
      addTaggedLog('WARN', '[APPLY]', `gateway 重启失败（非致命）: ${restartErr.message?.substring(0, 200)}`);
    }

    const applyRecord = {
      id: snapshot.id,
      templateId,
      templateName: templateData.name,
      appliedAt: new Date().toISOString(),
      selectedCategories: selectedCategories || [],
      configPaths: configPaths !== false,
      filesWritten,
      filesSkipped,
      configConflicts,
      snapshotPath,
      errors: unbundleErrors
    };

    if (!existsSync(APPLY_RECORD_DIR)) {
      mkdirSync(APPLY_RECORD_DIR, { recursive: true });
    }
    writeFileSync(join(APPLY_RECORD_DIR, `${applyRecord.id}.json`), JSON.stringify(applyRecord, null, 2), 'utf-8');

    res.json({
      success: true,
      applied: {
        filesWritten,
        filesSkipped,
        configHydrated: configPaths !== false,
        categories: selectedCategories || [],
        configConflicts
      },
      errors: unbundleErrors,
      backupPath: snapshotPath
    });
  } catch (err) {
    addTaggedLog('ERROR', '[APPLY]', `模板应用失败: ${err.message}`);
    res.json({ success: false, error: err.message });
  }
});

app.get('/template/snapshots', (req, res) => {
  try {
    if (!existsSync(SNAPSHOT_DIR)) {
      return res.json({ success: true, snapshots: [] });
    }
    const files = readdirSync(SNAPSHOT_DIR).filter(f => f.endsWith('.json'));
    const snapshots = files.map(f => {
      try {
        const content = JSON.parse(readFileSync(join(SNAPSHOT_DIR, f), 'utf-8'));
        return {
          id: content.id,
          createdAt: content.createdAt,
          templateId: content.templateId,
          templateName: content.templateName,
          selectedCategories: content.selectedCategories,
          filesCount: Object.keys(content.fileContents || {}).length,
          newFilesCount: (content.newFiles || []).length,
          path: join(SNAPSHOT_DIR, f)
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    while (snapshots.length > 10) {
      const oldest = snapshots.pop();
      try {
        if (!oldest.pinned) {
          unlinkSync(join(SNAPSHOT_DIR, `${oldest.id}.json`));
        }
      } catch (e) {}
    }

    res.json({ success: true, snapshots });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/template/snapshot/:id/rollback', (req, res) => {
  try {
    const result = rollbackFromSnapshot(OPENCLAW_CONFIG_DIR, req.params.id);
    res.json(result);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.delete('/template/snapshot/:id', (req, res) => {
  try {
    const snapshotPath = join(SNAPSHOT_DIR, `${req.params.id}.json`);
    if (existsSync(snapshotPath)) {
      unlinkSync(snapshotPath);
      addTaggedLog('INFO', '[SNAPSHOT]', `快照已删除: ${req.params.id}`);
    }
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.get('/template/apply-records', (req, res) => {
  try {
    if (!existsSync(APPLY_RECORD_DIR)) {
      return res.json({ success: true, records: [] });
    }
    const files = readdirSync(APPLY_RECORD_DIR).filter(f => f.endsWith('.json'));
    const records = files.map(f => {
      try {
        return JSON.parse(readFileSync(join(APPLY_RECORD_DIR, f), 'utf-8'));
      } catch (e) {
        return null;
      }
    }).filter(Boolean).sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
    res.json({ success: true, records });
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

app.get('/api/diagnostic', (req, res) => {
  res.json({
    MANIFEST_DIR,
    OPENCLAW_CONFIG_DIR,
    homedir: os.homedir(),
    cwd: process.cwd(),
    env_OPENCLAW_TEST_DIR: process.env.OPENCLAW_TEST_DIR,
    test_dir_files: existsSync(MANIFEST_DIR) ? readdirSync(MANIFEST_DIR).filter(f => f.startsWith('manifest_') && f.endsWith('.json')) : []
  });
});

const ALLOWED_CLI_COMMANDS = [
  'openclaw channels login --channel feishu',
  'openclaw devices approve',
  'openclaw doctor'
];

app.post('/api/cli/exec', (req, res) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ success: false, error: '缺少命令参数' });
    }

    const isAllowed = ALLOWED_CLI_COMMANDS.some(allowed => command.startsWith(allowed));
    if (!isAllowed) {
      return res.status(403).json({ success: false, error: `不允许执行的命令: ${command}` });
    }

    addLog('INFO', `执行命令: ${command}`);

    const isWindows = process.platform === 'win32';

    if (isWindows) {
      spawn('cmd', ['/c', 'start', 'cmd', '/k', command], {
        windowsHide: false,
        detached: true,
        stdio: 'ignore'
      }).unref();
      return res.json({ success: true, output: '已在新窗口启动命令，请查看弹出的终端窗口' });
    }

    const args = command.split(' ');
    const cmd = args[0];
    const cmdArgs = args.slice(1);

    const child = spawn(cmd, cmdArgs, {
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    if (isWindows) {
      child.unref();
    }

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      addLog('INFO', `[cli stdout] ${text.replace(/\n/g, ' ').trim()}`);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      addLog('WARN', `[cli stderr] ${text.replace(/\n/g, ' ').trim()}`);
    });

    child.on('close', (code) => {
      addLog('INFO', `命令完成，退出码: ${code}`);
      res.json({
        success: code === 0,
        exitCode: code,
        output: stdout,
        error: stderr
      });
    });

    child.on('error', (err) => {
      addLog('ERROR', `命令执行失败: ${err.message}`);
      res.status(500).json({
        success: false,
        error: err.message
      });
    });
  } catch (err) {
    addLog('ERROR', `命令执行异常: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/config/proxy', (req, res) => {
  try {
    const { enabled, serverUrl, userToken } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.json({ success: false, error: 'enabled 参数必填' });
    }

    if (!existsSync(OPENCLAW_CONFIG_FILE)) {
      return res.json({ success: false, error: 'openclaw.json 不存在' });
    }

    const config = JSON.parse(readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8'));
    if (!config.models) config.models = {};
    if (!config.models.providers) config.models.providers = {};

    const proxyRules = getCachedRule('PROXY_RULES', PROXY_RULES);
    const providerNames = proxyRules.providers;
    const rules = enabled ? proxyRules.enable : proxyRules.disable;
    const vars = { serverUrl, userToken: userToken || 'proxy', _providers: providerNames };

    if (enabled && !serverUrl) {
      return res.json({ success: false, error: '启用代理需要提供 serverUrl' });
    }

    if (enabled) {
      for (const providerName of providerNames) {
        if (!config.models.providers[providerName]) {
          config.models.providers[providerName] = {};
        }
      }
    }

    const newConfig = applyProxyRules(config, rules, vars, 'openclaw.json');
    writeFileSync(OPENCLAW_CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');
    addLog('INFO', enabled ? `代理已启用: baseUrl 指向 ${serverUrl}/api/proxy/` : '代理已关闭: 已恢复原始 provider 配置');

    const agentIds = [];
    if (newConfig.agents?.list && Array.isArray(newConfig.agents.list)) {
      for (const agent of newConfig.agents.list) {
        if (agent.id) agentIds.push(agent.id);
      }
    }

    for (const agentId of agentIds) {
      const authProfilesPath = join(OPENCLAW_CONFIG_DIR, 'agents', agentId, 'agent', 'auth-profiles.json');
      if (existsSync(authProfilesPath)) {
        try {
          const authData = JSON.parse(readFileSync(authProfilesPath, 'utf-8'));
          if (authData.profiles) {
            const newAuthData = applyAuthProfilesRules(authData, rules, vars, providerNames);
            writeFileSync(authProfilesPath, JSON.stringify(newAuthData, null, 2), 'utf-8');
            addLog('INFO', `代理${enabled ? '启用' : '关闭'}: Agent [${agentId}] auth-profiles.json 已${enabled ? '更新' : '恢复'}`);
          }
        } catch (e) {
          addLog('WARN', `Agent [${agentId}] auth-profiles.json 更新失败: ${e.message}`);
        }
      }

      const modelsJsonPath = join(OPENCLAW_CONFIG_DIR, 'agents', agentId, 'agent', 'models.json');
      if (existsSync(modelsJsonPath)) {
        try {
          const modelsData = JSON.parse(readFileSync(modelsJsonPath, 'utf-8'));
          if (modelsData.providers) {
            const newModelsData = applyAgentModelsRules(modelsData, rules, vars, providerNames);
            writeFileSync(modelsJsonPath, JSON.stringify(newModelsData, null, 2), 'utf-8');
            addLog('INFO', `代理${enabled ? '启用' : '关闭'}: Agent [${agentId}] models.json 已${enabled ? '更新' : '恢复'}`);
          }
        } catch (e) {
          addLog('WARN', `Agent [${agentId}] models.json 更新失败: ${e.message}`);
        }
      }
    }

    res.json({ success: true, enabled });
  } catch (err) {
    addLog('ERROR', `代理配置失败: ${err.message}`);
    res.json({ success: false, error: err.message });
  }
});

app.get('/config/proxy', (req, res) => {
  try {
    if (!existsSync(OPENCLAW_CONFIG_FILE)) {
      return res.json({ success: false, enabled: false });
    }
    const config = JSON.parse(readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8'));
    const enabled = config.models?.useProxy === true;
    res.json({ success: true, enabled });
  } catch (err) {
    res.json({ success: false, enabled: false, error: err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`OpenClaw Launcher running on port ${PORT}`);
  try {
    await fetchSystemConfigFromServer();
    await fetchMigrationRulesFromServer();
    await fetchSystemRulesFromServer();
    addLog('INFO', `[system_config] 规则加载完成，共缓存 ${Object.keys(SYSTEM_CONFIG_CACHE).length} 条规则`);
  } catch (err) {
    addLog('ERROR', `[system_config] 启动失败: ${err.message}`);
    process.exit(1);
  }
});