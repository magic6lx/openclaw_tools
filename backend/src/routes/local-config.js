const express = require('express');
const router = express.Router();
const localConfigController = require('../controllers/LocalConfigController');
const { authMiddleware } = require('../middleware/auth');

router.get('/detect-directories', localConfigController.detectDirectories);
router.post('/import-from-directory', localConfigController.importFromDirectory);
router.post('/create-template', localConfigController.createTemplate);
router.post('/validate-config', localConfigController.validateConfig);
router.get('/system-info', localConfigController.getSystemInfo);
router.post('/preview-config', localConfigController.previewConfig);

module.exports = router;