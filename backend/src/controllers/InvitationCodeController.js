const invitationCodeService = require('../services/InvitationCodeService');

class InvitationCodeController {
  async getAll(req, res) {
    try {
      const { status } = req.query;
      const invitationCodes = await invitationCodeService.getAllCodes(status);
      res.json({
        success: true,
        data: {
          codes: invitationCodes
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async generate(req, res) {
    try {
      const { max_devices = 3, tokens_limit = 50000, expires_in_months = 3, requests_limit = 10 } = req.body;
      const invitationCode = await invitationCodeService.generateCode(max_devices, tokens_limit, expires_in_months, requests_limit);
      res.status(201).json({
        success: true,
        data: invitationCode
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async validate(req, res) {
    try {
      const { code } = req.params;
      const result = await invitationCodeService.validateCode(code);
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

  async bindDevice(req, res) {
    try {
      const { code } = req.params;
      const { device_id, device_info } = req.body;

      if (!device_id) {
        return res.status(400).json({
          success: false,
          message: '设备ID不能为空'
        });
      }

      const user = await invitationCodeService.bindDevice(code, device_id, device_info);
      res.status(201).json({
        success: true,
        data: user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async unbindDevice(req, res) {
    try {
      const { userId } = req.params;
      const result = await invitationCodeService.unbindDevice(userId);
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

  async disableCode(req, res) {
    try {
      const { code } = req.params;
      const invitationCode = await invitationCodeService.disableCode(code);
      res.json({
        success: true,
        data: invitationCode
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async enableCode(req, res) {
    try {
      const { code } = req.params;
      const invitationCode = await invitationCodeService.enableCode(code);
      res.json({
        success: true,
        data: invitationCode
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getDevices(req, res) {
    try {
      const { code } = req.params;
      const result = await invitationCodeService.getDevicesByCode(code);
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

  async getDeviceStatus(req, res) {
    try {
      const { userId } = req.params;
      const result = await invitationCodeService.getDeviceStatus(userId);
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

  async updateTokens(req, res) {
    try {
      const { code } = req.params;
      const { tokens_limit } = req.body;
      const invitationCode = await invitationCodeService.updateTokensLimit(code, tokens_limit);
      res.json({
        success: true,
        data: invitationCode
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async updateExpiry(req, res) {
    try {
      const { code } = req.params;
      const { expires_in_months } = req.body;
      const invitationCode = await invitationCodeService.updateExpiryDate(code, expires_in_months);
      res.json({
        success: true,
        data: invitationCode
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async consumeTokens(req, res) {
    try {
      const { code } = req.params;
      const { tokens } = req.body;
      const invitationCode = await invitationCodeService.consumeTokens(code, tokens);
      res.json({
        success: true,
        data: invitationCode
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getConfigByCode(req, res) {
    try {
      const { code } = req.params;
      const config = await invitationCodeService.getConfigByCode(code);
      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new InvitationCodeController();