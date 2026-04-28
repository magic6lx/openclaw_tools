const express = require('express');
const router = express.Router();
const logService = require('../services/logService');
const { login, authMiddleware, adminMiddleware, getInvitations, createInvitation, updateInvitation, deleteInvitation } = require('../middleware/auth');

function redactSensitiveInfo(obj, depth = 0) {
  if (depth > 10 || !obj || typeof obj !== 'object') return obj;
  const sensitiveKeys = ['token', 'apiKey', 'api_key', 'password', 'secret', 'key', 'botToken', 'appToken'];
  const result = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(result)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      if (result[key] && typeof result[key] === 'string' && result[key].length > 0) {
        result[key] = '***REDACTED***';
      }
    } else if (typeof result[key] === 'object') {
      result[key] = redactSensitiveInfo(result[key], depth + 1);
    }
  }
  return result;
}

router.post('/auth/login', login);
router.get('/auth/verify', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

router.get('/invitations', authMiddleware, adminMiddleware, getInvitations);
router.post('/invitations', authMiddleware, adminMiddleware, createInvitation);
router.put('/invitations/:id', authMiddleware, adminMiddleware, updateInvitation);
router.delete('/invitations/:id', authMiddleware, adminMiddleware, deleteInvitation);

router.post('/logs/upload', async (req, res) => {
  try {
    const { deviceId, logs } = req.body;
    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: '缺少 logs 参数' });
    }
    const result = await logService.saveLogs(logs);
    res.json(result);
  } catch (err) {
    console.error('保存日志失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/launcher-logs/upload', async (req, res) => {
  try {
    const { deviceId, logs } = req.body;
    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: '缺少 logs 参数' });
    }
    const result = await logService.saveLogs(logs);
    res.json(result);
  } catch (err) {
    console.error('保存日志失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const { deviceId, level, source, startTime, endTime, limit = 100, offset = 0 } = req.query;
    const logs = await logService.getLogs({ deviceId, level, source, startTime, endTime, limit: parseInt(limit), offset: parseInt(offset) });
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('获取日志失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/devices', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const devices = await logService.getAllDevices();
    res.json({ success: true, data: devices });
  } catch (err) {
    console.error('获取设备失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/devices/:deviceId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.params;
    if (!deviceId && deviceId !== '') {
      return res.status(400).json({ success: false, error: '缺少设备ID' });
    }
    const decodedDeviceId = decodeURIComponent(deviceId);
    await logService.deleteDeviceLogs(decodedDeviceId);
    res.json({ success: true, message: `已删除设备 ${decodedDeviceId || '(空)'} 及其关联日志` });
  } catch (err) {
    console.error('删除设备失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/launcher/version', (req, res) => {
  const { execSync } = require('child_process');
  try {
    const npmVersion = execSync('npm view openclaw version', { encoding: 'utf8' }).trim();
    const localVersion = execSync('npm list openclaw --depth=0 2>/dev/null', { encoding: 'utf8' }).trim();
    const currentVersion = localVersion.match(/openclaw@(\d+\.\d+\.\d+)/)?.[1] || 'unknown';
    const isLatest = currentVersion === npmVersion;

    res.json({
      installed: true,
      currentVersion,
      latestVersion: npmVersion,
      isLatest,
      npmPath: execSync('npm root -g', { encoding: 'utf8' }).trim()
    });
  } catch (err) {
    res.json({
      installed: false,
      message: '未检测到 OpenClaw 安装'
    });
  }
});

router.get('/version', (req, res) => {
  const { execSync } = require('child_process');
  try {
    const npmVersion = execSync('npm view openclaw version', { encoding: 'utf8' }).trim();
    const localVersion = execSync('npm list openclaw --depth=0 2>/dev/null', { encoding: 'utf8' }).trim();
    const currentVersion = localVersion.match(/openclaw@(\d+\.\d+\.\d+)/)?.[1] || 'unknown';
    const isLatest = currentVersion === npmVersion;

    res.json({
      installed: true,
      currentVersion,
      latestVersion: npmVersion,
      isLatest,
      npmPath: execSync('npm root -g', { encoding: 'utf8' }).trim()
    });
  } catch (err) {
    res.json({
      installed: false,
      message: '未检测到 OpenClaw 安装'
    });
  }
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const MODEL_PROVIDER_MAP = {
  'gpt-4': 'openai',
  'gpt-4-turbo': 'openai',
  'gpt-4o': 'openai',
  'gpt-3.5-turbo': 'openai',
  'claude-3-opus': 'anthropic',
  'claude-3-sonnet': 'anthropic',
  'claude-3-haiku': 'anthropic',
  'claude-2': 'anthropic',
  'gemini-pro': 'google',
  'gemini-1.5-pro': 'google',
  'doubao': 'volcengine',
  'doubao-seed': 'volcengine',
};

const PROVIDER_API_BASE = {
  'openai': 'https://api.openai.com/v1',
  'anthropic': 'https://api.anthropic.com/v1',
  'google': 'https://generativelanguage.googleapis.com/v1beta',
  'volcengine': 'https://ark.cn-beijing.volces.com/api/v3'
};

router.post('/proxy/chat', authMiddleware, async (req, res) => {
  try {
    const { model, messages, temperature, max_tokens } = req.body;
    const tokenProxy = req.user.tokenProxy;

    if (!tokenProxy || !tokenProxy.enabled) {
      return res.status(403).json({ error: 'Token代理未启用' });
    }

    const providers = tokenProxy.providers || {};
    let providerName = 'openai';
    if (model?.startsWith('volcengine/') || model?.includes('doubao')) {
      providerName = 'volcengine';
    } else if (MODEL_PROVIDER_MAP[model]) {
      providerName = MODEL_PROVIDER_MAP[model];
    }
    const providerConfig = providers[providerName];

    if (!providerConfig || !providerConfig.apiKey) {
      return res.status(403).json({ error: `代理未配置${providerName}的API Key` });
    }

    const quota = tokenProxy.quota || { total: 100000, used: 0 };
    if (quota.used >= quota.total) {
      return res.status(403).json({ error: 'Token配额已用完' });
    }

    const apiBase = PROVIDER_API_BASE[providerName] || providerConfig.apiBase || 'https://api.openai.com/v1';

    let requestBody = {
      model,
      messages,
      temperature: temperature || 0.7,
      max_tokens: max_tokens || 2000
    };

    let headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${providerConfig.apiKey}`
    };

    if (providerName === 'anthropic') {
      headers['x-api-key'] = providerConfig.apiKey;
      delete headers['Authorization'];
      requestBody = {
        model,
        messages,
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 2000
      };
    }

    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (data.usage) {
      const db = require('../db');
      const tokensUsed = (data.usage.prompt_tokens || 0) + (data.usage.completion_tokens || 0);
      await db.query(
        'INSERT INTO token_usage (device_id, invitation_id, model, input_tokens, output_tokens) VALUES (?, ?, ?, ?, ?)',
        [req.user.deviceId || '', req.user.invitationId || null, model, data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0]
      );
      await db.query(
        'UPDATE invitations SET token_proxy = JSON_SET(IFNULL(token_proxy, \'{}\'), \'$.quota.used\', ?) WHERE id = ?',
        [quota.used + tokensUsed, req.user.invitationId]
      );
    }

    res.json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/proxy/usage', authMiddleware, async (req, res) => {
  try {
    const db = require('../db');
    const invitationId = req.user.invitationId;

    const [usage] = await db.query(
      'SELECT SUM(input_tokens) as totalInput, SUM(output_tokens) as totalOutput, COUNT(*) as requestCount FROM token_usage WHERE invitation_id = ?',
      [invitationId]
    );

    const [quota] = await db.query(
      'SELECT token_proxy FROM invitations WHERE id = ?',
      [invitationId]
    );

    const proxyConfig = quota[0]?.token_proxy ? JSON.parse(quota[0].token_proxy) : {};
    const total = proxyConfig.quota?.total || 100000;
    const used = usage?.totalInput + usage?.totalOutput || 0;

    res.json({
      success: true,
      data: {
        total,
        used,
        remaining: Math.max(0, total - used),
        requests: usage?.requestCount || 0
      }
    });
  } catch (err) {
    console.error('Get usage error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates', authMiddleware, async (req, res) => {
  try {
    const db = require('../db');
    const templates = await db.query('SELECT * FROM templates ORDER BY created_at DESC');
    const parsedTemplates = templates.map(t => ({
      ...t,
      config: t.config ? (typeof t.config === 'string' ? JSON.parse(t.config) : t.config) : null,
      env: t.env || null
    }));
    res.json({ success: true, data: parsedTemplates });
  } catch (err) {
    console.error('Get templates error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates/approved', async (req, res) => {
  try {
    const db = require('../db');
    const templates = await db.query('SELECT * FROM templates WHERE status = ? ORDER BY created_at DESC', ['approved']);
    const parsedTemplates = templates.map(t => ({
      id: t.id,
      name: t.name,
      label: t.name,
      description: t.description,
      icon: '📋',
      config: t.config ? (typeof t.config === 'string' ? JSON.parse(t.config) : t.config) : {},
      env: t.env || null
    }));
    res.json({ success: true, data: parsedTemplates });
  } catch (err) {
    console.error('Get approved templates error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates/:id', authMiddleware, async (req, res) => {
  try {
    const db = require('../db');
    const [template] = await db.query('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (!template) {
      return res.status(404).json({ error: '模板不存在' });
    }
    const parsedTemplate = {
      ...template,
      config: template.config ? (typeof template.config === 'string' ? JSON.parse(template.config) : template.config) : null,
      env: template.env || null
    };
    res.json({ success: true, data: parsedTemplate });
  } catch (err) {
    console.error('Get template error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = require('../db');
    const { name, description, config, env } = req.body;
    const configJson = (config && typeof config === 'object') ? JSON.stringify(config) : (config || '{}');
    const envJson = (env && typeof env === 'object') ? JSON.stringify(env) : (env || null);
    const result = await db.query(
      'INSERT INTO templates (name, description, config, env, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || '', configJson, envJson, 'pending', req.user?.invitationId || null]
    );
    res.json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/templates/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = require('../db');
    const { name, description, config, env, status } = req.body;
    const configJson = (config && typeof config === 'object') ? JSON.stringify(config) : (config || null);
    const envJson = (env && typeof env === 'object') ? JSON.stringify(env) : (env || null);
    await db.query(
      'UPDATE templates SET name = ?, description = ?, config = ?, env = ?, status = ? WHERE id = ?',
      [name, description || '', configJson, envJson, status || 'pending', req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update template error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/templates/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = require('../db');
    await db.query('DELETE FROM templates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = require('../db');
    await db.query('UPDATE templates SET status = ? WHERE id = ?', ['approved', req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Approve template error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/config/presets', (req, res) => {
  const presets = [
    {
      id: 'minimal',
      label: '最小配置',
      description: '仅基础启动配置',
      icon: '⚡',
      category: '基础',
      config: {
        launcher: { autoStart: false, checkUpdate: true, logLevel: 'info' },
        gateway: { enabled: true, port: 18789 }
      }
    },
    {
      id: 'standard',
      label: '标准配置',
      description: '包含智能体和会话管理',
      icon: '🎯',
      category: '推荐',
      config: {
        launcher: { autoStart: false, checkUpdate: true, logLevel: 'info' },
        gateway: { 
          enabled: true, 
          port: 18789,
          controlUi: { enabled: true, allowInsecureAuth: false },
          channelHealthCheckMinutes: 5
        },
        agents: {
          defaults: {
            workspace: '~/.openclaw/workspace',
            model: { primary: 'anthropic/claude-sonnet-4-6', fallbacks: [] },
            skills: [],
            sandbox: { mode: 'off', scope: 'agent' },
            heartbeat: { every: '30m', target: 'last' }
          }
        },
        session: {
          dmScope: 'per-channel-peer',
          threadBindings: { enabled: true, idleHours: 24 },
          reset: { mode: 'off', atHour: 4 }
        }
      }
    },
    {
      id: 'multi-channel',
      label: '多通道配置',
      description: '启用多个消息平台',
      icon: '📱',
      category: '高级',
      config: {
        launcher: { autoStart: false, checkUpdate: true, logLevel: 'info' },
        gateway: { enabled: true, port: 18789 },
        agents: {
          defaults: {
            workspace: '~/.openclaw/workspace',
            model: { primary: 'anthropic/claude-sonnet-4-6', fallbacks: ['openai/gpt-4.1'] }
          }
        },
        channels: {
          whatsapp: { enabled: false, dmPolicy: 'pairing', allowFrom: [] },
          telegram: { enabled: false, botToken: '', dmPolicy: 'pairing' },
          discord: { enabled: false, token: '', voice: { enabled: false } },
          slack: { enabled: false, botToken: '', appToken: '' }
        }
      }
    },
    {
      id: 'automation',
      label: '自动化配置',
      description: '启用定时任务和Webhooks',
      icon: '🤖',
      category: '高级',
      config: {
        launcher: { autoStart: true, checkUpdate: true, logLevel: 'info' },
        gateway: { enabled: true, port: 18789 },
        agents: {
          defaults: {
            workspace: '~/.openclaw/workspace',
            model: { primary: 'anthropic/claude-sonnet-4-6' },
            skills: ['github', 'weather']
          }
        },
        hooks: { enabled: true, token: '', path: '/hooks' },
        cron: { enabled: true, maxConcurrentRuns: 2, sessionRetention: '24h' },
        tools: { exec: { enabled: true, applyPatch: { workspaceOnly: true } } }
      }
    },
    {
      id: 'secure',
      label: '安全配置',
      description: '启用沙箱和密钥管理',
      icon: '🔒',
      category: '企业',
      config: {
        launcher: { autoStart: false, checkUpdate: true, logLevel: 'warn' },
        gateway: { enabled: true, port: 18789, controlUi: { enabled: true, allowInsecureAuth: false } },
        agents: {
          defaults: {
            workspace: '~/.openclaw/workspace',
            model: { primary: 'anthropic/claude-sonnet-4-6' },
            sandbox: { mode: 'non-main', scope: 'agent' }
          }
        },
        secrets: { providers: { default: { source: 'env' } } },
        tools: { exec: { enabled: true, applyPatch: { workspaceOnly: true } } }
      }
    }
  ];
  const redactedPresets = presets.map(p => ({
    ...p,
    config: redactSensitiveInfo(p.config)
  }));
  res.json({ success: true, data: redactedPresets });
});

router.get('/config/schema', authMiddleware, (req, res) => {
  const { CONFIG_SCHEMA, SECTION_META } = require('../config/configSchema');
  res.json({ success: true, data: { schema: CONFIG_SCHEMA, sectionMeta: SECTION_META } });
});

router.get('/config/server', authMiddleware, adminMiddleware, async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  const configPath = process.env.OPENCLAW_CONFIG_PATH || 
    path.join(require('os').homedir(), '.openclaw', 'openclaw.json');
  
  try {
    if (!fs.existsSync(configPath)) {
      return res.json({ 
        success: false, 
        message: `配置文件不存在: ${configPath}` 
      });
    }
    
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    
    res.json({ 
      success: true, 
      data: config,
      path: configPath
    });
  } catch (err) {
    console.error('Read server config error:', err);
    res.status(500).json({ 
      success: false, 
      error: `读取配置文件失败: ${err.message}` 
    });
  }
});

router.post('/config/save', authMiddleware, async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  const configPath = process.env.OPENCLAW_CONFIG_PATH || 
    path.join(require('os').homedir(), '.openclaw', 'openclaw.json');
  
  try {
    const config = req.body.config || req.body;
    
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: '无效的配置数据' 
      });
    }
    
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    const tempPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    fs.renameSync(tempPath, configPath);
    
    res.json({ 
      success: true, 
      message: '配置保存成功',
      path: configPath
    });
  } catch (err) {
    console.error('Save config error:', err);
    res.status(500).json({ 
      success: false, 
      error: `保存配置失败: ${err.message}` 
    });
  }
});

router.post('/templates/:id/distribute', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = require('../db');
    const [template] = await db.query('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (!template) {
      return res.status(404).json({ error: '模板不存在' });
    }
    await db.query('UPDATE templates SET status = ? WHERE id = ?', ['approved', req.params.id]);
    res.json({ success: true, message: '模板已发放' });
  } catch (err) {
    console.error('Distribute template error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/config/launcher', authMiddleware, async (req, res) => {
  try {
    const response = await fetch('http://127.0.0.1:3003/config/export');
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/config/cli', authMiddleware, async (req, res) => {
  try {
    const { execSync } = require('child_process');
    const { path } = req.body;

    if (!path) {
      return res.status(400).json({ success: false, error: '缺少配置路径参数' });
    }

    const result = execSync(`openclaw config get ${path}`, {
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true
    });

    res.json({ success: true, result: result.trim() });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      stderr: err.stderr?.toString() || ''
    });
  }
});

router.post('/config/cli/all', authMiddleware, async (req, res) => {
  try {
    const { execSync } = require('child_process');
    const paths = [
      'agents.defaults.workspace',
      'agents.defaults.model.primary',
      'agents.list',
      'models.providers',
      'gateway.port',
      'logging.level'
    ];

    const results = {};
    for (const p of paths) {
      try {
        const result = execSync(`openclaw config get ${p}`, {
          encoding: 'utf8',
          timeout: 5000,
          windowsHide: true
        });
        results[p] = { success: true, value: result.trim() };
      } catch (e) {
        results[p] = { success: false, error: e.message };
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const ALLOWED_CLI_COMMANDS = [
  'openclaw channels login',
  'openclaw channels status',
  'openclaw channels list',
  'openclaw gateway restart',
  'openclaw pairing approve',
  'openclaw devices list',
  'openclaw devices approve'
];

router.post('/cli/exec', authMiddleware, async (req, res) => {
  try {
    const { spawn } = require('child_process');
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ success: false, error: '缺少命令参数' });
    }

    const isAllowed = ALLOWED_CLI_COMMANDS.some(allowed => command.startsWith(allowed));
    if (!isAllowed) {
      return res.status(403).json({ success: false, error: `不允许执行的命令: ${command}` });
    }

    const args = command.split(' ');
    const cmd = args[0];
    const cmdArgs = args.slice(1);

    const child = spawn(cmd, cmdArgs, {
      encoding: 'utf8',
      timeout: 60000,
      windowsHide: true,
      shell: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      res.json({
        success: code === 0,
        exitCode: code,
        output: stdout,
        error: stderr
      });
    });

    child.on('error', (err) => {
      res.status(500).json({
        success: false,
        error: err.message
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
