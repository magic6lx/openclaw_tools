const { User } = require('../models');
const invitationCodeService = require('./InvitationCodeService');
const authService = require('./AuthService');

class UserService {
  async loginWithInvitationCode(code, deviceId, deviceInfo = {}) {
    try {
      const validation = await invitationCodeService.validateCode(code);
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      let user = await User.findOne({
        where: {
          invitation_code_id: validation.invitationCode.id,
          device_id: deviceId
        },
        include: [{ model: require('../models').InvitationCode, as: 'invitationCode' }]
      });

      if (!user) {
        user = await invitationCodeService.bindDevice(code, deviceId, deviceInfo);
        user = await User.findByPk(user.id, {
          include: [{ model: require('../models').InvitationCode, as: 'invitationCode' }]
        });
      } else {
        await user.update({
          last_login_at: new Date(),
          role: user.invitationCode.role || 'user'
        });
        user = await User.findByPk(user.id, {
          include: [{ model: require('../models').InvitationCode, as: 'invitationCode' }]
        });
      }

      const token = authService.generateToken({
        userId: user.id,
        invitationCodeId: user.invitation_code_id,
        invitationCode: user.invitationCode.code,
        deviceId: user.device_id,
        role: user.invitationCode.role
      });

      // 获取邀请码的API配置
      const apiConfig = user.invitationCode ? {
        api_key_id: user.invitationCode.api_key_id,
        api_secret_key: user.invitationCode.api_secret_key,
        tokens_limit: user.invitationCode.tokens_limit,
        tokens_used: user.invitationCode.tokens_used,
        requests_limit: user.invitationCode.requests_limit,
        requests_used: user.invitationCode.requests_used,
        expires_at: user.invitationCode.expires_at
      } : null;

      return {
        user: {
          id: user.id,
          device_id: user.device_id,
          device_name: user.device_name,
          os_type: user.os_type,
          os_version: user.os_version,
          role: user.invitationCode.role,
          invitation_code: user.invitationCode.code,
          api_config: apiConfig
        },
        token
      };
    } catch (error) {
      throw new Error(`登录失败: ${error.message}`);
    }
  }

  async getUserInfo(userId) {
    const user = await User.findByPk(userId, {
      include: [{ model: require('../models').InvitationCode, as: 'invitationCode' }]
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    // 获取邀请码的API配置
    const apiConfig = user.invitationCode ? {
      api_key_id: user.invitationCode.api_key_id,
      api_secret_key: user.invitationCode.api_secret_key,
      tokens_limit: user.invitationCode.tokens_limit,
      tokens_used: user.invitationCode.tokens_used,
      requests_limit: user.invitationCode.requests_limit,
      requests_used: user.invitationCode.requests_used,
      expires_at: user.invitationCode.expires_at
    } : null;

    return {
      id: user.id,
      device_id: user.device_id,
      device_name: user.device_name,
      os_type: user.os_type,
      os_version: user.os_version,
      hardware_info: user.hardware_info,
      role: user.invitationCode ? user.invitationCode.role : 'user',
      status: user.status,
      last_login_at: user.last_login_at,
      invitation_code: user.invitationCode.code,
      api_config: apiConfig
    };
  }

  async updateUserInfo(userId, updateData) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    await user.update(updateData);
    return this.getUserInfo(userId);
  }

  async logout(userId) {
    return { message: '登出成功' };
  }

  async refreshToken(token) {
    try {
      const decoded = authService.verifyToken(token);
      const user = await User.findByPk(decoded.userId, {
        include: [{ model: require('../models').InvitationCode, as: 'invitationCode' }]
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      const newToken = authService.generateToken({
        userId: user.id,
        invitationCodeId: user.invitation_code_id,
        invitationCode: user.invitationCode.code,
        deviceId: user.device_id
      });

      return { token: newToken };
    } catch (error) {
      throw new Error(`刷新Token失败: ${error.message}`);
    }
  }
}

module.exports = new UserService();