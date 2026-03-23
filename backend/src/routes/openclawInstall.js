const express = require('express');
const router = express.Router();
const openClawInstallController = require('../controllers/OpenClawInstallController');

router.get('/check-system', (req, res) => openClawInstallController.checkSystem(req, res));
router.post('/install', (req, res) => openClawInstallController.installOpenClaw(req, res));
router.get('/logs', (req, res) => openClawInstallController.getInstallLogs(req, res));
router.get('/verify', (req, res) => openClawInstallController.verifyInstallation(req, res));

module.exports = router;