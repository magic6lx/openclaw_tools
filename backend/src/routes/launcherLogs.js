const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const LOGS_DIR = path.join(__dirname, '../../logs/launcher');

router.post('/upload', async (req, res) => {
  try {
    const { deviceId, logs, timestamp } = req.body;

    if (!deviceId || !logs) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    await fs.mkdir(LOGS_DIR, { recursive: true });

    const fileName = `launcher-${deviceId}-${Date.now()}.log`;
    const filePath = path.join(LOGS_DIR, fileName);

    const logContent = `[${new Date(timestamp || Date.now()).toISOString()}] Device: ${deviceId}\n${logs}`;
    await fs.writeFile(filePath, logContent, 'utf-8');

    res.json({ success: true, message: '日志已接收', fileName });
  } catch (error) {
    console.error('接收Launcher日志失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/list', async (req, res) => {
  try {
    const { deviceId } = req.query;

    await fs.mkdir(LOGS_DIR, { recursive: true });

    const files = await fs.readdir(LOGS_DIR);

    let logFiles = files
      .filter(f => f.startsWith('launcher-'))
      .map(f => {
        const stats = require('fs').statSync(path.join(LOGS_DIR, f));
        return {
          fileName: f,
          createdAt: stats.birthtime,
          size: stats.size
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    if (deviceId) {
      logFiles = logFiles.filter(f => f.fileName.includes(deviceId));
    }

    res.json({ success: true, data: logFiles });
  } catch (error) {
    console.error('获取日志列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/download/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;

    if (!fileName || !fileName.includes('launcher-')) {
      return res.status(400).json({ success: false, message: '无效的文件名' });
    }

    const filePath = path.join(LOGS_DIR, fileName);

    await fs.access(filePath);

    res.download(filePath, fileName);
  } catch (error) {
    console.error('下载日志失败:', error);
    res.status(404).json({ success: false, message: '日志文件不存在' });
  }
});

module.exports = router;