const configValidator = {
  validateConfig(config, fileName) {
    const errors = [];
    const warnings = [];
    const security = [];

    if (!config || typeof config !== 'object') {
      errors.push({
        code: 'INVALID_FORMAT',
        message: '配置文件格式错误，必须是有效的JSON对象',
        suggestion: '请检查JSON语法，确保使用双引号'
      });
      return { success: false, data: { errors, warnings, security, valid: false } };
    }

    if (fileName === 'openclaw.json') {
      if (!config.api_config) {
        errors.push({
          code: 'MISSING_API_CONFIG',
          message: '缺少 api_config 配置',
          suggestion: '请添加 api_config 配置块'
        });
      }
      if (!config.agents) {
        warnings.push({
          code: 'MISSING_AGENTS',
          message: '未配置 agents',
          suggestion: '建议配置 agents 以启用代理功能'
        });
      }
    }

    if (config.api_config) {
      if (!config.api_config.api_key_id && !config.api_config.proxy_url) {
        warnings.push({
          code: 'MISSING_API_CREDENTIALS',
          message: 'API配置缺少认证信息',
          suggestion: '请提供 api_key_id 或使用代理'
        });
      }
    }

    return {
      success: true,
      data: {
        errors,
        warnings,
        security,
        valid: errors.length === 0,
        summary: {
          errorCount: errors.length,
          warningCount: warnings.length,
          securityCount: security.length,
          totalIssues: errors.length + warnings.length + security.length
        }
      }
    };
  }
};

export default configValidator;