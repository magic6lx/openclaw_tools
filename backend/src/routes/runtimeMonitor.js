const express = require('express');
const router = express.Router();
const RuntimeMonitorController = require('../controllers/RuntimeMonitorController');
const { authMiddleware } = require('../middleware/auth');

const runtimeMonitorController = RuntimeMonitorController.getInstance();

router.get('/system-status', authMiddleware, (req, res) => runtimeMonitorController.getSystemStatus(req, res));
router.post('/restart-openclaw', authMiddleware, (req, res) => runtimeMonitorController.restartOpenClaw(req, res));
router.get('/openclaw-operation-progress', authMiddleware, (req, res) => runtimeMonitorController.getOpenClawOperationProgress(req, res));
router.get('/openclaw-logs', authMiddleware, (req, res) => runtimeMonitorController.getOpenClawLogs(req, res));
router.get('/node-processes-details', authMiddleware, (req, res) => runtimeMonitorController.getNodeProcessesDetails(req, res));
router.get('/process-logs', authMiddleware, (req, res) => runtimeMonitorController.getProcessLogs(req, res));
router.get('/process-details/:pid', authMiddleware, (req, res) => runtimeMonitorController.getProcessDetails(req, res));

module.exports = router;