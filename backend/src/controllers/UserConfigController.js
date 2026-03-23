const userConfigService = require('../services/UserConfigService');
const { authMiddleware } = require('../middleware/auth');

class UserConfigController {
  async applyTemplate(req, res) {
    try {
      const userId = req.user.userId;
      const { templateId } = req.params;
      const { custom_config } = req.body;
      const config = await userConfigService.applyTemplate(userId, templateId, custom_config);
      res.status(201).json({
        success: true,
        data: config
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async update(req, res) {
    try {
      const userId = req.user.userId;
      const { configId } = req.params;
      const config = await userConfigService.updateConfig(userId, configId, req.body);
      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getList(req, res) {
    try {
      const userId = req.user.userId;
      const configs = await userConfigService.getUserConfigs(userId);
      res.json({
        success: true,
        data: configs
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getActive(req, res) {
    try {
      const userId = req.user.userId;
      const config = await userConfigService.getActiveConfig(userId);
      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async activate(req, res) {
    try {
      const userId = req.user.userId;
      const { configId } = req.params;
      const config = await userConfigService.activateConfig(userId, configId);
      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async delete(req, res) {
    try {
      const userId = req.user.userId;
      const { configId } = req.params;
      const result = await userConfigService.deleteConfig(userId, configId);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async export(req, res) {
    try {
      const userId = req.user.userId;
      const { configId } = req.params;
      const result = await userConfigService.exportConfig(userId, configId);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async import(req, res) {
    try {
      const userId = req.user.userId;
      const config = await userConfigService.importConfig(userId, req.body);
      res.status(201).json({
        success: true,
        data: config
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new UserConfigController();