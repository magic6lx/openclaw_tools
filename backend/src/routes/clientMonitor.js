const express = require('express');
const router = express.Router();
const ClientMonitorController = require('../controllers/ClientMonitorController');
const { authMiddleware } = require('../middleware/auth');

router.post('/submit', authMiddleware, (req, res) => ClientMonitorController.submitClientInfo(req, res));
router.get('/list', authMiddleware, (req, res) => ClientMonitorController.getClientInfoList(req, res));
router.get('/detail/:deviceId', authMiddleware, (req, res) => ClientMonitorController.getClientDetail(req, res));

module.exports = router;