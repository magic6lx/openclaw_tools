const configValidator = require('../services/ConfigValidator');
const { authMiddleware } = require('../middleware/auth');

class ConfigValidatorController {
  async validate(req, res) {
    try {
      const config = req.body.config;
      const options = req.body.options || {};

      const result = configValidator.validateConfig(config, options);
      
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

  async validateStructure(req, res) {
    try {
      const config = req.body.config;
      const result = configValidator.validateConfigStructure(config);
      
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

  async validateFields(req, res) {
    try {
      const config = req.body.config;
      const schema = req.body.schema || configValidator.getDefaultSchema();
      const result = configValidator.validateConfigFields(config, schema);
      
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

  async validateValues(req, res) {
    try {
      const config = req.body.config;
      const result = configValidator.validateConfigValues(config);
      
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

  async validateCompatibility(req, res) {
    try {
      const config = req.body.config;
      const environment = req.body.environment;
      const result = configValidator.validateConfigCompatibility(config, environment);
      
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

  async validateSecurity(req, res) {
    try {
      const config = req.body.config;
      const result = configValidator.validateConfigSecurity(config);
      
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

  async getDefaultSchema(req, res) {
    try {
      const schema = configValidator.getDefaultSchema();
      res.json({
        success: true,
        data: schema
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new ConfigValidatorController();