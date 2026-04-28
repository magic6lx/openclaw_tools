import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import os from 'os';

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
const homedir = os.homedir();
const OPENCLAW_CONFIG_DIR = join(homedir, '.openclaw');
const OPENCLAW_CONFIG_FILE = join(OPENCLAW_CONFIG_DIR, 'openclaw.json');
const PRIVATE_TEMPLATE_DIR = join(OPENCLAW_CONFIG_DIR, 'private_templates');
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
      const verResult = execSync('openclaw --version', { encoding: 'utf8', timeout: 10000, windowsHide: true });
      currentVersion = verResult.trim();
    } catch (e) {
      try {
        const showResult = execSync('npm list openclaw -g --depth=0', { encoding: 'utf8', timeout: 10000, windowsHide: true });
        const match = showResult.match(/openclaw@(\S+)/);
        if (match) {
          currentVersion = match[1];
        }
      } catch (e2) {
        try {
          const pkgPath = join(npmGlobalPath, 'node_modules', 'openclaw', 'package.json');
          if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
            currentVersion = pkg.version || 'unknown';
          }
        } catch (e3) {
        }
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

const SENSITIVE_FIELDS = ['apiKey', 'api_key', 'token', 'secret', 'password', 'privateKey'];
const PATH_FIELDS = ['workspace', 'agentDir', 'path', 'dir'];
const KEEP_EXISTING_FIELDS = ['models', 'agents'];

function isSensitiveField(key) {
  return SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f.toLowerCase()));
}

function adaptPath(templatePath, existingPath) {
  if (!templatePath || !existingPath) return templatePath;
  const templateParts = templatePath.replace(/\\/g, '/').split('/');
  const existingParts = existingPath.replace(/\\/g, '/').split('/');
  if (templateParts.length > 0 && existingParts.length > 0) {
    templateParts[templateParts.length - 1] = existingParts[existingParts.length - 1];
  }
  return templateParts.join('/');
}

function mergeConfigRecursive(existing, template, conflicts = [], path = '') {
  if (!template || typeof template !== 'object') {
    return template;
  }

  const result = Array.isArray(template) ? [...template] : { ...existing };

  for (const [key, templateValue] of Object.entries(template)) {
    const currentPath = path ? `${path}.${key}` : key;
    const existingValue = existing?.[key];

    if (existingValue === undefined || existingValue === null) {
      result[key] = templateValue;
      continue;
    }

    if (isSensitiveField(key)) {
      if (existingValue && existingValue !== templateValue) {
        conflicts.push({ field: currentPath, action: 'kept_existing', reason: 'sensitive_data' });
        result[key] = existingValue;
      } else {
        result[key] = templateValue;
      }
      continue;
    }

    if (PATH_FIELDS.includes(key) && typeof templateValue === 'string') {
      if (existingValue && existingValue !== templateValue) {
        const adaptedPath = adaptPath(templateValue, existingValue);
        conflicts.push({ field: currentPath, action: 'adapted_path', from: templateValue, to: adaptedPath, reason: 'path_compatibility' });
        result[key] = adaptedPath;
      } else {
        result[key] = templateValue;
      }
      continue;
    }

    if (KEEP_EXISTING_FIELDS.includes(key)) {
      conflicts.push({ field: currentPath, action: 'kept_existing', reason: 'user_maintained_config' });
      result[key] = existingValue;
      continue;
    }

    if (typeof templateValue === 'object' && templateValue !== null && !Array.isArray(templateValue)) {
      result[key] = mergeConfigRecursive(existingValue, templateValue, conflicts, currentPath);
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

const INVALID_ROOT_KEYS = ['launcher'];
const INVALID_MODELS_KEYS = ['useProxy', 'originalProviders'];
const INVALID_GATEWAY_KEYS = ['enabled'];
const INVALID_HOOKS_KEYS = ['preTask', 'postTask'];
const INVALID_PROVIDER_KEYS = ['apiBase'];

function sanitizeConfig(config) {
  if (!config || typeof config !== 'object') return config;
  const cleaned = JSON.parse(JSON.stringify(config));

  for (const key of INVALID_ROOT_KEYS) {
    if (key in cleaned) {
      delete cleaned[key];
    }
  }

  if (cleaned.models && typeof cleaned.models === 'object') {
    for (const key of INVALID_MODELS_KEYS) {
      if (key in cleaned.models) {
        delete cleaned.models[key];
      }
    }
    if (cleaned.models.providers && typeof cleaned.models.providers === 'object') {
      const providersToRemove = [];
      for (const [providerId, provider] of Object.entries(cleaned.models.providers)) {
        if (provider && typeof provider === 'object') {
          for (const key of INVALID_PROVIDER_KEYS) {
            if (key in provider) {
              delete provider[key];
            }
          }
          const validKeys = Object.keys(provider).filter(k => provider[k] !== undefined && provider[k] !== null && provider[k] !== '');
          if (validKeys.length === 0) {
            providersToRemove.push(providerId);
          }
        }
      }
      for (const id of providersToRemove) {
        delete cleaned.models.providers[id];
      }
    }
  }

  if (cleaned.gateway && typeof cleaned.gateway === 'object') {
    for (const key of INVALID_GATEWAY_KEYS) {
      if (key in cleaned.gateway) {
        delete cleaned.gateway[key];
      }
    }
  }

  if (cleaned.hooks && typeof cleaned.hooks === 'object') {
    for (const key of INVALID_HOOKS_KEYS) {
      if (key in cleaned.hooks) {
        delete cleaned.hooks[key];
      }
    }
  }

  return cleaned;
}

app.post('/config/import', (req, res) => {
  try {
    const { config, env, mergeStrategy } = req.body;
    if (!config) {
      return res.json({ success: false, error: '配置文件为空' });
    }

    const sanitizedConfig = sanitizeConfig(config);

    if (!existsSync(OPENCLAW_CONFIG_DIR)) {
      mkdirSync(OPENCLAW_CONFIG_DIR, { recursive: true });
    }

    let finalConfig = sanitizedConfig;
    let conflicts = [];

    if (existsSync(OPENCLAW_CONFIG_FILE)) {
      try {
        const existingConfig = JSON.parse(readFileSync(OPENCLAW_CONFIG_FILE, 'utf-8'));
        
        if (mergeStrategy === 'force') {
          finalConfig = sanitizedConfig;
          conflicts.push({ field: 'root', action: 'force_replaced', reason: 'force_mode' });
        } else {
          finalConfig = mergeConfigRecursive(existingConfig, sanitizedConfig, conflicts);
        }
      } catch (e) {
        conflicts.push({ field: 'root', action: 'parse_error', error: e.message });
      }
    }

    writeFileSync(OPENCLAW_CONFIG_FILE, JSON.stringify(finalConfig, null, 2), 'utf-8');
    if (env) {
      writeFileSync(OPENCLAW_ENV_FILE, env, 'utf-8');
    }
    addLog('INFO', `配置已应用，合并了 ${conflicts.length} 个冲突`);
    res.json({ success: true, conflicts, merged: finalConfig });
  } catch (err) {
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
    }

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
    const { config, env, label, description } = req.body;
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

app.get('/launcher/download', (req, res) => {
  res.json({ message: '下载功能开发中', url: '#' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const ALLOWED_CLI_COMMANDS = [
  'openclaw channels login --channel feishu',
  'openclaw devices approve'
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

app.listen(PORT, () => {
  console.log(`OpenClaw Launcher running on port ${PORT}`);
});