/**
 * API代理服务
 * 用于安全地转发AI模型API请求，保护真实的API密钥
 */

const { Op } = require('sequelize');
const { ApiKey, ApiUsageLog, InvitationCode } = require('../models');

class ApiProxyService {
  constructor() {
    // 支持的模型提供商
    this.providers = {
      openai: {
        baseUrl: 'https://api.openai.com/v1',
        keyHeader: 'Authorization',
        keyPrefix: 'Bearer '
      },
      anthropic: {
        baseUrl: 'https://api.anthropic.com/v1',
        keyHeader: 'x-api-key',
        keyPrefix: ''
      },
      // 可以添加更多提供商
    };
  }

  /**
   * 创建临时API密钥（用于测试）
   * @param {string} templateId - 模板ID
   * @param {Object} options - 配置选项
   * @returns {Object} 临时密钥信息
   */
  async createTempApiKey(templateId, options = {}) {
    const {
      maxRequests = 10,        // 最大请求次数
      maxTokens = 10000,       // 最大token数
      expiresInHours = 24,     // 过期时间（小时）
      allowedModels = ['gpt-3.5-turbo']  // 允许的模型
    } = options;

    // 生成随机密钥
    const keyId = this.generateKeyId();
    const secretKey = this.generateSecretKey();

    const apiKey = await ApiKey.create({
      key_id: keyId,
      secret_key: secretKey,
      template_id: templateId,
      type: 'temp',  // 临时密钥
      status: 'active',
      max_requests: maxRequests,
      max_tokens: maxTokens,
      used_requests: 0,
      used_tokens: 0,
      allowed_models: JSON.stringify(allowedModels),
      expires_at: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      created_at: new Date(),
      updated_at: new Date()
    });

    return {
      keyId: apiKey.key_id,
      secretKey: apiKey.secret_key,
      expiresAt: apiKey.expires_at,
      maxRequests,
      maxTokens
    };
  }

  /**
   * 验证API密钥
   * @param {string} keyId - 密钥ID
   * @param {string} secretKey - 密钥
   * @returns {Object} 验证结果
   */
  async validateApiKey(keyId, secretKey) {
    const apiKey = await ApiKey.findOne({
      where: {
        key_id: keyId,
        secret_key: secretKey,
        status: 'active'
      }
    });

    if (!apiKey) {
      return { valid: false, error: 'Invalid API key' };
    }

    // 检查是否过期
    if (new Date() > apiKey.expires_at) {
      await apiKey.update({ status: 'expired' });
      return { valid: false, error: 'API key has expired' };
    }

    // 检查是否超出配额
    if (apiKey.used_requests >= apiKey.max_requests) {
      return { valid: false, error: 'Request quota exceeded' };
    }

    if (apiKey.used_tokens >= apiKey.max_tokens) {
      return { valid: false, error: 'Token quota exceeded' };
    }

    return {
      valid: true,
      apiKey,
      remainingRequests: apiKey.max_requests - apiKey.used_requests,
      remainingTokens: apiKey.max_tokens - apiKey.used_tokens
    };
  }

  /**
   * 代理API请求
   * @param {string} keyId - 密钥ID
   * @param {string} secretKey - 密钥
   * @param {string} provider - 提供商（openai/anthropic等）
   * @param {string} endpoint - API端点
   * @param {Object} requestBody - 请求体
   * @returns {Object} 响应结果
   */
  async proxyRequest(keyId, secretKey, provider, endpoint, requestBody) {
    // 1. 验证密钥
    const validation = await this.validateApiKey(keyId, secretKey);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const { apiKey } = validation;

    // 2. 检查模型是否允许
    const allowedModels = JSON.parse(apiKey.allowed_models || '[]');
    const requestedModel = requestBody.model;
    if (requestedModel && !allowedModels.includes(requestedModel)) {
      throw new Error(`Model '${requestedModel}' is not allowed. Allowed models: ${allowedModels.join(', ')}`);
    }

    // 3. 获取真实的API密钥（从环境变量或安全存储）
    const realApiKey = this.getRealApiKey(provider);
    if (!realApiKey) {
      throw new Error(`API key not configured for provider: ${provider}`);
    }

    // 4. 构建请求
    const providerConfig = this.providers[provider];
    const url = `${providerConfig.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      [providerConfig.keyHeader]: `${providerConfig.keyPrefix}${realApiKey}`
    };

    // 5. 发送请求
    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();
      const duration = Date.now() - startTime;

      // 6. 记录使用情况
      const tokensUsed = responseData.usage?.total_tokens || 
                        responseData.usage?.input_tokens + responseData.usage?.output_tokens || 
                        0;

      await this.logUsage(apiKey.id, provider, endpoint, requestedModel, tokensUsed, duration, 'success');

      // 7. 更新配额使用
      await apiKey.increment({
        used_requests: 1,
        used_tokens: tokensUsed
      });

      // 8. 返回响应（移除敏感信息）
      return {
        success: true,
        data: responseData,
        usage: {
          requestsUsed: apiKey.used_requests + 1,
          requestsLimit: apiKey.max_requests,
          tokensUsed: apiKey.used_tokens + tokensUsed,
          tokensLimit: apiKey.max_tokens
        }
      };
    } catch (error) {
      await this.logUsage(apiKey.id, provider, endpoint, requestedModel, 0, Date.now() - startTime, 'error', error.message);
      throw error;
    }
  }

  /**
   * 获取真实的API密钥
   * @param {string} provider - 提供商
   * @returns {string} API密钥
   */
  getRealApiKey(provider) {
    // 从环境变量获取（不要在代码中硬编码！）
    const envKey = process.env[`${provider.toUpperCase()}_API_KEY`];
    if (envKey) return envKey;

    // 或者从数据库的安全存储中获取
    // return this.getKeyFromSecureStorage(provider);

    return null;
  }

  /**
   * 记录API使用情况
   */
  async logUsage(apiKeyId, provider, endpoint, model, tokensUsed, duration, status, errorMessage = null) {
    try {
      await ApiUsageLog.create({
        api_key_id: apiKeyId,
        provider,
        endpoint,
        model,
        tokens_used: tokensUsed,
        duration_ms: duration,
        status,
        error_message: errorMessage,
        created_at: new Date()
      });
    } catch (error) {
      console.error('Failed to log API usage:', error);
    }
  }

  /**
   * 获取密钥使用情况统计
   */
  async getUsageStats(keyId) {
    const apiKey = await ApiKey.findOne({
      where: { key_id: keyId },
      include: [{
        model: ApiUsageLog,
        as: 'usageLogs',
        limit: 100,
        order: [['created_at', 'DESC']]
      }]
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    return {
      keyId: apiKey.key_id,
      type: apiKey.type,
      status: apiKey.status,
      quota: {
        requests: {
          used: apiKey.used_requests,
          limit: apiKey.max_requests,
          remaining: apiKey.max_requests - apiKey.used_requests
        },
        tokens: {
          used: apiKey.used_tokens,
          limit: apiKey.max_tokens,
          remaining: apiKey.max_tokens - apiKey.used_tokens
        }
      },
      expiresAt: apiKey.expires_at,
      recentUsage: apiKey.usageLogs
    };
  }

  /**
   * 吊销API密钥
   */
  async revokeApiKey(keyId) {
    const apiKey = await ApiKey.findOne({ where: { key_id: keyId } });
    if (!apiKey) {
      throw new Error('API key not found');
    }

    await apiKey.update({ status: 'revoked' });
    return { success: true, message: 'API key revoked' };
  }

  /**
   * 验证邀请码的API密钥
   * @param {string} keyId - 密钥ID
   * @param {string} secretKey - 密钥
   * @returns {Object} 验证结果
   */
  async validateInvitationCodeKey(keyId, secretKey) {
    const invitationCode = await InvitationCode.findOne({
      where: {
        api_key_id: keyId,
        api_secret_key: secretKey,
        status: 'active'
      }
    });

    if (!invitationCode) {
      return { valid: false, error: 'Invalid API key' };
    }

    // 检查是否过期
    if (invitationCode.expires_at && new Date() > invitationCode.expires_at) {
      await invitationCode.update({ status: 'disabled' });
      return { valid: false, error: 'Invitation code has expired' };
    }

    // 检查请求次数配额
    if (invitationCode.requests_used >= invitationCode.requests_limit) {
      return { valid: false, error: 'Request quota exceeded' };
    }

    // 检查token配额
    if (invitationCode.tokens_used >= invitationCode.tokens_limit) {
      return { valid: false, error: 'Token quota exceeded' };
    }

    return {
      valid: true,
      invitationCode,
      remainingRequests: invitationCode.requests_limit - invitationCode.requests_used,
      remainingTokens: invitationCode.tokens_limit - invitationCode.tokens_used
    };
  }

  /**
   * 通过邀请码代理API请求
   * @param {string} keyId - 密钥ID
   * @param {string} secretKey - 密钥
   * @param {string} provider - 提供商
   * @param {string} endpoint - API端点
   * @param {Object} requestBody - 请求体
   * @returns {Object} 响应结果
   */
  async proxyRequestByInvitationCode(keyId, secretKey, provider, endpoint, requestBody) {
    // 1. 验证邀请码密钥
    const validation = await this.validateInvitationCodeKey(keyId, secretKey);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const { invitationCode } = validation;

    // 2. 获取真实的API密钥
    const realApiKey = this.getRealApiKey(provider);
    if (!realApiKey) {
      throw new Error(`API key not configured for provider: ${provider}`);
    }

    // 3. 构建请求
    const providerConfig = this.providers[provider];
    const url = `${providerConfig.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      [providerConfig.keyHeader]: `${providerConfig.keyPrefix}${realApiKey}`
    };

    // 4. 发送请求
    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();
      const duration = Date.now() - startTime;

      // 5. 计算token使用量
      const tokensUsed = responseData.usage?.total_tokens || 
                        (responseData.usage?.input_tokens + responseData.usage?.output_tokens) || 
                        0;

      // 6. 更新邀请码配额使用
      await invitationCode.increment({
        requests_used: 1,
        tokens_used: tokensUsed
      });

      // 7. 返回响应
      return {
        success: true,
        data: responseData,
        usage: {
          requestsUsed: invitationCode.requests_used + 1,
          requestsLimit: invitationCode.requests_limit,
          tokensUsed: invitationCode.tokens_used + tokensUsed,
          tokensLimit: invitationCode.tokens_limit
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取邀请码的使用情况统计
   * @param {string} keyId - 密钥ID
   * @returns {Object} 使用情况统计
   */
  async getInvitationCodeUsageStats(keyId) {
    const invitationCode = await InvitationCode.findOne({
      where: { api_key_id: keyId }
    });

    if (!invitationCode) {
      throw new Error('Invitation code not found');
    }

    return {
      keyId: invitationCode.api_key_id,
      code: invitationCode.code,
      status: invitationCode.status,
      quota: {
        requests: {
          used: invitationCode.requests_used,
          limit: invitationCode.requests_limit,
          remaining: invitationCode.requests_limit - invitationCode.requests_used
        },
        tokens: {
          used: invitationCode.tokens_used,
          limit: invitationCode.tokens_limit,
          remaining: invitationCode.tokens_limit - invitationCode.tokens_used
        }
      },
      expiresAt: invitationCode.expires_at
    };
  }

  // 生成随机密钥ID
  generateKeyId() {
    return 'oc_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // 生成随机密钥
  generateSecretKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

module.exports = new ApiProxyService();
