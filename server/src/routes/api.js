const express = require('express');
const router = express.Router();
const logService = require('../services/logService');
const { login, authMiddleware, adminMiddleware, getInvitations, createInvitation, updateInvitation, deleteInvitation } = require('../middleware/auth');

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

router.get('/launcher/version', (req, res) => {
  res.json({ version: '1.0.0', downloadUrl: '/launcher/download' });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.post('/proxy/chat', authMiddleware, async (req, res) => {
  try {
    const { model, messages, temperature, max_tokens } = req.body;
    const tokenProxy = req.user.tokenProxy;

    if (!tokenProxy || !tokenProxy.enabled || !tokenProxy.apiKey) {
      return res.status(403).json({ error: 'Token代理未启用或未配置' });
    }

    if (tokenProxy.quota && tokenProxy.quota.used >= tokenProxy.quota.total) {
      return res.status(403).json({ error: 'Token配额已用完' });
    }

    const response = await fetch(`${tokenProxy.apiBase || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenProxy.apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4',
        messages,
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 2000
      })
    });

    const data = await response.json();

    if (data.usage) {
      const db = require('../db');
      await db.query(
        'INSERT INTO token_usage (device_id, invitation_id, model, input_tokens, output_tokens) VALUES (?, ?, ?, ?, ?)',
        [req.user.deviceId || '', req.user.invitationId || null, model || 'gpt-4', data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0]
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
    res.json({ success: true, data: templates });
  } catch (err) {
    console.error('Get templates error:', err);
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
    res.json({ success: true, data: template });
  } catch (err) {
    console.error('Get template error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const db = require('../db');
    const { name, description, category, configContent } = req.body;
    const result = await db.query(
      'INSERT INTO templates (name, description, category, config_content, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || '', category || 'imported', configContent || '{}', 'pending', req.user.invitationId]
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
    const { name, description, category, configContent, status } = req.body;
    await db.query(
      'UPDATE templates SET name = ?, description = ?, category = ?, config_content = ?, status = ? WHERE id = ?',
      [name, description || '', category, configContent || '{}', status || 'pending', req.params.id]
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

module.exports = router;
