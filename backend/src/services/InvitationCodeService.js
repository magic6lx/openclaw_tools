const { InvitationCode, User } = require('../models');
const InvitationCodeGenerator = require('../utils/InvitationCodeGenerator');

// 生成随机密钥ID
const generateKeyId = () => {
  return 'oc_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// 生成随机密钥
const generateSecretKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

class InvitationCodeService {
  async getAllCodes(status = null) {
    try {
      const whereClause = {};
      if (status && status !== 'all') {
        whereClause.status = status;
      }

      const invitationCodes = await InvitationCode.findAll({
        where: whereClause,
        order: [['created_at', 'DESC']]
      });

      return invitationCodes;
    } catch (error) {
      throw new Error(`获取邀请码列表失败: ${error.message}`);
    }
  }

  async generateCode(maxDevices = 3, tokensLimit = 50000, expiresInMonths = 3, requestsLimit = 10, role = 'user') {
    try {
      const code = await InvitationCodeGenerator.generateUnique(InvitationCode);
      
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + expiresInMonths);
      
      const apiKeyId = generateKeyId();
      const apiSecretKey = generateSecretKey();
      
      const invitationCode = await InvitationCode.create({
        code,
        max_devices: maxDevices,
        current_devices: 0,
        tokens_limit: tokensLimit,
        tokens_used: 0,
        requests_limit: requestsLimit,
        requests_used: 0,
        expires_at: expiresAt,
        api_key_id: apiKeyId,
        api_secret_key: apiSecretKey,
        status: 'active',
        role: role
      });
      
      return {
        ...invitationCode.toJSON(),
        tempApiKey: {
          keyId: apiKeyId,
          secretKey: apiSecretKey
        }
      };
    } catch (error) {
      throw new Error(`生成邀请码失败: ${error.message}`);
    }
  }

  async validateCode(code) {
    const validation = InvitationCodeGenerator.validate(code);
    if (!validation.valid) {
      return { valid: false, message: validation.message };
    }

    const invitationCode = await InvitationCode.findOne({ where: { code } });
    if (!invitationCode) {
      return { valid: false, message: '邀请码不存在' };
    }

    if (invitationCode.status === 'disabled') {
      return { valid: false, message: '邀请码已被禁用' };
    }

    if (invitationCode.expires_at && new Date() > invitationCode.expires_at) {
      return { valid: false, message: '邀请码已过期' };
    }

    if (invitationCode.current_devices >= invitationCode.max_devices) {
      return { valid: false, message: '邀请码已达到最大设备数量限制' };
    }

    if (invitationCode.tokens_used >= invitationCode.tokens_limit) {
      return { valid: false, message: '邀请码的token使用量已达上限' };
    }

    return { valid: true, invitationCode };
  }

  async bindDevice(code, deviceId, deviceInfo = {}) {
    const validation = await this.validateCode(code);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const invitationCode = validation.invitationCode;

    const existingUser = await User.findOne({
      where: {
        invitation_code_id: invitationCode.id,
        device_id: deviceId
      }
    });

    if (existingUser) {
      return existingUser;
    }

    const user = await User.create({
      invitation_code_id: invitationCode.id,
      device_id: deviceId,
      device_name: deviceInfo.device_name || 'Unknown Device',
      os_type: deviceInfo.os_type,
      os_version: deviceInfo.os_version,
      hardware_info: deviceInfo.hardware_info,
      role: invitationCode.role || 'user',
      status: 'active',
      last_login_at: new Date()
    });

    await invitationCode.update({
      current_devices: invitationCode.current_devices + 1
    });

    return user;
  }

  async unbindDevice(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const invitationCode = await InvitationCode.findByPk(user.invitation_code_id);
    if (invitationCode) {
      await invitationCode.update({
        current_devices: Math.max(0, invitationCode.current_devices - 1)
      });
    }

    await user.destroy();
    return { message: '设备解绑成功' };
  }

  async disableCode(code) {
    const invitationCode = await InvitationCode.findOne({ where: { code } });
    if (!invitationCode) {
      throw new Error('邀请码不存在');
    }

    await invitationCode.update({ status: 'disabled' });
    return invitationCode;
  }

  async enableCode(code) {
    const invitationCode = await InvitationCode.findOne({ where: { code } });
    if (!invitationCode) {
      throw new Error('邀请码不存在');
    }

    await invitationCode.update({ status: 'active' });
    return invitationCode;
  }

  async getDevicesByCode(code) {
    const invitationCode = await InvitationCode.findOne({ where: { code } });
    if (!invitationCode) {
      throw new Error('邀请码不存在');
    }

    const users = await User.findAll({
      where: { invitation_code_id: invitationCode.id },
      order: [['created_at', 'DESC']]
    });

    return {
      invitationCode,
      devices: users
    };
  }

  async getDeviceStatus(userId) {
    const user = await User.findByPk(userId, {
      include: [{ model: InvitationCode, as: 'invitationCode' }]
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    return {
      user,
      invitationCode: user.invitationCode,
      canBindMore: user.invitationCode.current_devices < user.invitationCode.max_devices
    };
  }

  async updateTokensLimit(code, tokensLimit) {
    const invitationCode = await InvitationCode.findOne({ where: { code } });
    if (!invitationCode) {
      throw new Error('邀请码不存在');
    }

    await invitationCode.update({ tokens_limit: tokensLimit });
    return invitationCode;
  }

  async updateExpiryDate(code, expiresInMonths) {
    const invitationCode = await InvitationCode.findOne({ where: { code } });
    if (!invitationCode) {
      throw new Error('邀请码不存在');
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + expiresInMonths);
    
    await invitationCode.update({ expires_at: expiresAt });
    return invitationCode;
  }

  async consumeTokens(code, tokens) {
    const invitationCode = await InvitationCode.findOne({ where: { code } });
    if (!invitationCode) {
      throw new Error('邀请码不存在');
    }

    if (invitationCode.tokens_used + tokens > invitationCode.tokens_limit) {
      throw new Error('token使用量将超过限制');
    }

    await invitationCode.update({
      tokens_used: invitationCode.tokens_used + tokens
    });
    
    return invitationCode;
  }

  async getConfigByCode(code) {
    const invitationCode = await InvitationCode.findOne({ where: { code } });
    if (!invitationCode) {
      throw new Error('邀请码不存在');
    }

    if (invitationCode.status === 'disabled') {
      throw new Error('邀请码已被禁用');
    }

    if (invitationCode.expires_at && new Date() > invitationCode.expires_at) {
      throw new Error('邀请码已过期');
    }

    return {
      proxy_url: '/api/proxy/proxy-by-code',
      api_key_id: invitationCode.api_key_id,
      api_secret_key: invitationCode.api_secret_key,
      tokens_limit: invitationCode.tokens_limit,
      tokens_used: invitationCode.tokens_used,
      requests_limit: invitationCode.requests_limit,
      requests_used: invitationCode.requests_used,
      expires_at: invitationCode.expires_at
    };
  }
}

module.exports = new InvitationCodeService();