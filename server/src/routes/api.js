const express = require('express');
const router = express.Router();
const logService = require('../services/logService');
const { login, verify, authMiddleware } = require('../middleware/auth');

router.post('/auth/login', login);
router.get('/auth/verify', authMiddleware, verify);

router.post('/logs', async (req, res) => {
  try {
    const { deviceId, logs } = req.body;
    if (!deviceId || !logs) {
      return res.status(400).json({ error: '缺少 deviceId 或 logs' });
    }
    await logService.saveLogs(deviceId, logs);
    res.json({ success: true });
  } catch (err) {
    console.error('保存日志失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const { deviceId, limit = 500 } = req.query;
    const logs = await logService.getLogs(deviceId, parseInt(limit));
    res.json({ success: true, logs });
  } catch (err) {
    console.error('获取日志失败:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/launcher/version', (req, res) => {
  res.json({ version: '1.0.0', downloadUrl: '/launcher/download' });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = router;
