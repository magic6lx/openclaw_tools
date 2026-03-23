const userService = require('../services/UserService');
const { authMiddleware } = require('../middleware/auth');

class AuthController {
  async login(req, res) {
    try {
      const { code, device_id, device_info } = req.body;

      if (!code || !device_id) {
        return res.status(400).json({
          success: false,
          message: '邀请码和设备ID不能为空'
        });
      }

      const result = await userService.loginWithInvitationCode(code, device_id, device_info);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  async getUserInfo(req, res) {
    try {
      const userId = req.user.userId;
      const user = await userService.getUserInfo(userId);
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  async updateUserInfo(req, res) {
    try {
      const userId = req.user.userId;
      const updateData = req.body;
      const user = await userService.updateUserInfo(userId, updateData);
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async logout(req, res) {
    try {
      const result = await userService.logout(req.user.userId);
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

  async refreshToken(req, res) {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token不能为空'
        });
      }

      const result = await userService.refreshToken(token);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new AuthController();