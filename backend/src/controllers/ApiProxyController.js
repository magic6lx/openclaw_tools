/**
 * API代理控制器
 * 处理API密钥管理和代理请求
 */

const apiProxyService = require('../services/ApiProxyService');

class ApiProxyController {
  /**
   * 创建临时API密钥
   */
  async createTempKey(req, res) {
    try {
      const userId = req.user?.userId || 1;
      const { templateId, options } = req.body;

      if (!templateId) {
        return res.status(400).json({
          success: false,
          message: 'Template ID is required'
        });
      }

      const tempKey = await apiProxyService.createTempApiKey(templateId, {
        maxRequests: options?.maxRequests || 10,
        maxTokens: options?.maxTokens || 10000,
        expiresInHours: options?.expiresInHours || 24,
        allowedModels: options?.allowedModels || ['gpt-3.5-turbo']
      });

      res.json({
        success: true,
        data: tempKey
      });
    } catch (error) {
      console.error('Create temp key error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 代理API请求
   */
  async proxyRequest(req, res) {
    try {
      const { keyId, secretKey, provider, endpoint } = req.body;
      const requestBody = req.body.requestBody;

      if (!keyId || !secretKey || !provider || !endpoint) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters: keyId, secretKey, provider, endpoint'
        });
      }

      const result = await apiProxyService.proxyRequest(
        keyId,
        secretKey,
        provider,
        endpoint,
        requestBody
      );

      res.json(result);
    } catch (error) {
      console.error('Proxy request error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取密钥使用情况
   */
  async getUsageStats(req, res) {
    try {
      const { keyId } = req.params;

      if (!keyId) {
        return res.status(400).json({
          success: false,
          message: 'Key ID is required'
        });
      }

      const stats = await apiProxyService.getUsageStats(keyId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get usage stats error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 吊销API密钥
   */
  async revokeKey(req, res) {
    try {
      const userId = req.user?.userId || 1;
      const { keyId } = req.params;

      if (!keyId) {
        return res.status(400).json({
          success: false,
          message: 'Key ID is required'
        });
      }

      const result = await apiProxyService.revokeApiKey(keyId);

      res.json(result);
    } catch (error) {
      console.error('Revoke key error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 通过邀请码代理API请求
   */
  async proxyRequestByInvitationCode(req, res) {
    try {
      const { keyId, secretKey, provider, endpoint } = req.body;
      const requestBody = req.body.requestBody;

      if (!keyId || !secretKey || !provider || !endpoint) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters: keyId, secretKey, provider, endpoint'
        });
      }

      const result = await apiProxyService.proxyRequestByInvitationCode(
        keyId,
        secretKey,
        provider,
        endpoint,
        requestBody
      );

      res.json(result);
    } catch (error) {
      console.error('Proxy request by invitation code error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取邀请码API使用情况
   */
  async getInvitationCodeUsageStats(req, res) {
    try {
      const { keyId } = req.params;

      if (!keyId) {
        return res.status(400).json({
          success: false,
          message: 'Key ID is required'
        });
      }

      const stats = await apiProxyService.getInvitationCodeUsageStats(keyId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get invitation code usage stats error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new ApiProxyController();
