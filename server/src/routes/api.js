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

module.exports = router;
