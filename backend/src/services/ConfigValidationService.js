const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * 配置验证服务
 * 根据OpenClaw配置检查指南实现
 * 区分ERROR级别（必须修复）和WARN级别（建议修复）
 */
class ConfigValidationService {
  constructor() {
    // 验证级别定义
    this.LEVELS = {
      ERROR: 'error',   // 🔴 必须立即修复
      WARN: 'warning'   // ⚠️ 建议修复
    };
  }

  /**
   * 验证配置文件
   * @param {Object} config - 配置内容
   * @param {string} fileName - 文件名
   * @param {string} filePath - 文件路径（可选，用于安全检查）
   * @returns {Object} 验证结果
   */
  async validateConfig(config, fileName, filePath = null) {
    const errors = [];
    const warnings = [];
    const security = [];

    const lowerFileName = fileName.toLowerCase();

    // 1. 基础JSON格式验证
    const basicValidation = this.validateBasicStructure(config, fileName);
    errors.push(...basicValidation.errors);
    warnings.push(...basicValidation.warnings);

    // 2. 根据文件类型进行特定验证
    if (lowerFileName === 'openclaw.json') {
      const openclawValidation = this.validateOpenClawConfig(config, fileName);
      errors.push(...openclawValidation.errors);
      warnings.push(...openclawValidation.warnings);
      security.push(...openclawValidation.security);
    } else if (lowerFileName === 'auth-profiles.json') {
      const authValidation = this.validateAuthProfilesConfig(config, fileName);
      errors.push(...authValidation.errors);
      warnings.push(...authValidation.warnings);
      security.push(...authValidation.security);
    } else if (lowerFileName === '_meta.json') {
      const metaValidation = this.validateMetaConfig(config, fileName);
      errors.push(...metaValidation.errors);
      warnings.push(...metaValidation.warnings);
    } else if (lowerFileName.endsWith('.md')) {
      // Markdown文件不需要JSON结构验证
      const mdValidation = this.validateMarkdownConfig(config, fileName);
      errors.push(...mdValidation.errors);
      warnings.push(...mdValidation.warnings);
    } else {
      // 通用JSON验证
      const genericValidation = this.validateGenericConfig(config, fileName);
      errors.push(...genericValidation.errors);
      warnings.push(...genericValidation.warnings);
    }

    // 3. 安全检查（如果提供了文件路径）
    if (filePath) {
      const securityValidation = await this.validateSecurity(config, fileName, filePath);
      security.push(...securityValidation);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      security,
      summary: {
        errorCount: errors.length,
        warningCount: warnings.length,
        securityCount: security.length,
        totalIssues: errors.length + warnings.length + security.length
      }
    };
  }

  /**
   * 基础结构验证
   */
  validateBasicStructure(config, fileName) {
    const errors = [];
    const warnings = [];

    if (!config || typeof config !== 'object') {
      errors.push({
        level: 'error',
        code: 'JSON_FORMAT_ERROR',
        file: fileName,
        message: `[${fileName}] 配置必须是有效的JSON对象`,
        suggestion: '请检查JSON格式是否正确，确保所有括号和引号匹配'
      });
      return { errors, warnings };
    }

    if (Object.keys(config).length === 0) {
      warnings.push({
        level: 'warning',
        code: 'EMPTY_CONFIG',
        file: fileName,
        message: `[${fileName}] 配置对象为空`,
        suggestion: '请添加必要的配置项'
      });
    }

    return { errors, warnings };
  }

  /**
   * 验证openclaw.json主配置文件
   */
  validateOpenClawConfig(config, fileName) {
    const errors = [];
    const warnings = [];
    const security = [];

    // 🔴 ERROR级别：必需字段检查
    const requiredFields = ['meta', 'agents', 'models'];
    for (const field of requiredFields) {
      if (!config[field]) {
        errors.push({
          level: 'error',
          code: 'MISSING_REQUIRED_FIELD',
          file: fileName,
          field: field,
          message: `[${fileName}] 缺少必需字段: ${field}`,
          suggestion: `请在配置中添加"${field}"字段`
        });
      }
    }

    // 🔴 ERROR级别：Agent ID唯一性检查
    if (config.agents && config.agents.list) {
      const agentIds = config.agents.list.map(agent => agent.id);
      const duplicates = agentIds.filter((item, index) => agentIds.indexOf(item) !== index);
      if (duplicates.length > 0) {
        errors.push({
          level: 'error',
          code: 'DUPLICATE_AGENT_ID',
          file: fileName,
          message: `[${fileName}] 发现重复的Agent ID: ${[...new Set(duplicates)].join(', ')}`,
          suggestion: '请确保每个Agent的ID唯一'
        });
      }
    }

    // 🔴 ERROR级别：模型提供商配置检查
    if (config.models && config.models.providers) {
      for (const [providerName, providerConfig] of Object.entries(config.models.providers)) {
        if (!providerConfig.apiKey) {
          errors.push({
            level: 'error',
            code: 'MISSING_API_KEY',
            file: fileName,
            provider: providerName,
            message: `[${fileName}] 模型提供商"${providerName}"缺少apiKey`,
            suggestion: '请添加有效的API密钥'
          });
        }
      }
    }

    // ⚠️ WARN级别：推荐字段检查
    const recommendedFields = ['logging', 'gateway', 'channels', 'tools', 'browser', 'skills'];
    for (const field of recommendedFields) {
      if (!config[field]) {
        warnings.push({
          level: 'warning',
          code: 'MISSING_RECOMMENDED_FIELD',
          file: fileName,
          field: field,
          message: `[${fileName}] 缺少推荐字段: ${field}`,
          suggestion: `建议添加"${field}"配置以提高功能完整性`
        });
      }
    }

    // ⚠️ WARN级别：meta字段检查
    if (config.meta) {
      if (!config.meta.lastTouchedVersion) {
        warnings.push({
          level: 'warning',
          code: 'MISSING_META_VERSION',
          file: fileName,
          message: `[${fileName}] meta.lastTouchedVersion 缺失`,
          suggestion: '建议添加版本信息以便追踪配置变更'
        });
      }
      if (!config.meta.lastTouchedAt) {
        warnings.push({
          level: 'warning',
          code: 'MISSING_META_TIMESTAMP',
          file: fileName,
          message: `[${fileName}] meta.lastTouchedAt 缺失`,
          suggestion: '建议添加时间戳以便追踪配置变更'
        });
      }
    }

    // ⚠️ WARN级别：路径配置检查
    if (config.logging && config.logging.file) {
      const logPath = config.logging.file;
      if (logPath.includes('\\') || logPath.includes('/')) {
        // 检查是否使用了绝对路径
        if (/^[A-Za-z]:/.test(logPath) || logPath.startsWith('/')) {
          warnings.push({
            level: 'warning',
            code: 'ABSOLUTE_PATH_IN_CONFIG',
            file: fileName,
            path: logPath,
            message: `[${fileName}] 日志路径使用了绝对路径`,
            suggestion: '建议使用相对路径或占位符路径（如{WORKSPACE}/logs）以提高可移植性'
          });
        }
      }
    }

    // ⚠️ WARN级别：workspace路径检查
    if (config.agents && config.agents.defaults && config.agents.defaults.workspace) {
      const workspacePath = config.agents.defaults.workspace;
      if (/^[A-Za-z]:/.test(workspacePath) || workspacePath.startsWith('/')) {
        warnings.push({
          level: 'warning',
          code: 'ABSOLUTE_WORKSPACE_PATH',
          file: fileName,
          path: workspacePath,
          message: `[${fileName}] Workspace路径使用了绝对路径`,
          suggestion: '建议使用占位符路径（如{WORKSPACE}）以提高可移植性'
        });
      }
    }

    // 🔒 安全检查：API密钥格式检查
    if (config.models && config.models.providers) {
      for (const [providerName, providerConfig] of Object.entries(config.models.providers)) {
        if (providerConfig.apiKey) {
          // 检查API密钥是否明文存储
          if (providerConfig.apiKey.length < 10) {
            security.push({
              level: 'error',
              code: 'WEAK_API_KEY',
              file: fileName,
              provider: providerName,
              message: `[${fileName}] API密钥"${providerName}"长度过短，可能存在安全风险`,
              suggestion: '请使用完整的API密钥'
            });
          }

          // 检查是否使用了默认密钥
          const defaultKeys = ['your-api-key', 'api-key-here', 'placeholder', 'test-key'];
          if (defaultKeys.some(key => providerConfig.apiKey.toLowerCase().includes(key))) {
            security.push({
              level: 'error',
              code: 'DEFAULT_API_KEY',
              file: fileName,
              provider: providerName,
              message: `[${fileName}] API密钥"${providerName}"似乎是默认或占位符密钥`,
              suggestion: '请替换为真实的API密钥'
            });
          }
        }
      }
    }

    // 🔒 安全检查：浏览器配置检查
    if (config.browser && config.browser.executablePath) {
      const browserPath = config.browser.executablePath;
      if (browserPath.toLowerCase().includes('download') || 
          browserPath.toLowerCase().includes('temp') ||
          browserPath.toLowerCase().includes('tmp')) {
        security.push({
          level: 'warning',
          code: 'SUSPICIOUS_BROWSER_PATH',
          file: fileName,
          path: browserPath,
          message: `[${fileName}] 浏览器可执行路径位于临时目录，可能存在安全风险`,
          suggestion: '请使用系统默认的浏览器路径'
        });
      }
    }

    return { errors, warnings, security };
  }

  /**
   * 验证auth-profiles.json配置文件
   */
  validateAuthProfilesConfig(config, fileName) {
    const errors = [];
    const warnings = [];
    const security = [];

    // 🔴 ERROR级别：profiles字段检查
    if (!config.profiles && !config.authProfiles) {
      errors.push({
        level: 'error',
        code: 'MISSING_PROFILES_FIELD',
        file: fileName,
        message: `[${fileName}] 必须包含 profiles 或 authProfiles 字段`,
        suggestion: '请添加认证配置'
      });
    }

    // 🔴 ERROR级别：Profile结构检查
    const profiles = config.profiles || config.authProfiles || {};
    for (const [profileName, profile] of Object.entries(profiles)) {
      if (!profile.provider) {
        errors.push({
          level: 'error',
          code: 'MISSING_PROVIDER',
          file: fileName,
          profile: profileName,
          message: `[${fileName}] Profile"${profileName}"缺少provider字段`,
          suggestion: '请指定认证提供商（如volcengine、openai等）'
        });
      }
      // 向后兼容：支持type和mode两种字段名
      if (!profile.mode && !profile.type) {
        errors.push({
          level: 'error',
          code: 'MISSING_AUTH_MODE',
          file: fileName,
          profile: profileName,
          message: `[${fileName}] Profile"${profileName}"缺少mode或type字段`,
          suggestion: '请指定认证模式（如api_key、oauth等），支持mode或type字段名'
        });
      }
    }

    // 🔒 安全检查：敏感信息检查
    for (const [profileName, profile] of Object.entries(profiles)) {
      if (profile.apiKey || profile.secret || profile.password) {
        const sensitiveValue = profile.apiKey || profile.secret || profile.password;
        if (sensitiveValue.length < 8) {
          security.push({
            level: 'error',
            code: 'WEAK_CREDENTIAL',
            file: fileName,
            profile: profileName,
            message: `[${fileName}] Profile"${profileName}"的凭证长度过短`,
            suggestion: '请使用更安全的凭证'
          });
        }
      }
    }

    return { errors, warnings, security };
  }

  /**
   * 验证_meta.json技能配置文件
   */
  validateMetaConfig(config, fileName) {
    const errors = [];
    const warnings = [];

    // 🔴 ERROR级别：必需字段检查
    if (!config.name && !config.slug) {
      errors.push({
        level: 'error',
        code: 'MISSING_SKILL_NAME',
        file: fileName,
        message: `[${fileName}] 必须包含 name 或 slug 字段`,
        suggestion: '请添加技能名称'
      });
    }

    if (!config.version) {
      errors.push({
        level: 'error',
        code: 'MISSING_VERSION',
        file: fileName,
        message: `[${fileName}] 必须包含 version 字段`,
        suggestion: '请添加版本号（格式：X.Y.Z）'
      });
    }

    // 🔴 ERROR级别：版本号格式检查
    if (config.version && !/^\d+\.\d+\.\d+$/.test(config.version)) {
      errors.push({
        level: 'error',
        code: 'INVALID_VERSION_FORMAT',
        file: fileName,
        version: config.version,
        message: `[${fileName}] 版本号格式不正确: ${config.version}`,
        suggestion: '请使用语义化版本格式（如1.0.0）'
      });
    }

    // ⚠️ WARN级别：推荐字段检查
    const recommendedMetaFields = ['description', 'author', 'tags', 'category', 'license'];
    if (config.meta) {
      for (const field of recommendedMetaFields) {
        if (!config.meta[field]) {
          warnings.push({
            level: 'warning',
            code: 'MISSING_META_FIELD',
            file: fileName,
            field: field,
            message: `[${fileName}] meta.${field} 缺失`,
            suggestion: `建议添加${field}以提高技能的可发现性`
          });
        }
      }
    } else {
      warnings.push({
        level: 'warning',
        code: 'MISSING_META_SECTION',
        file: fileName,
        message: `[${fileName}] 缺少meta字段`,
        suggestion: '建议添加meta字段包含技能的详细描述信息'
      });
    }

    return { errors, warnings, security: [] };
  }

  /**
   * 验证Markdown配置文件
   */
  validateMarkdownConfig(config, fileName) {
    const errors = [];
    const warnings = [];

    // Markdown文件通常不需要严格的JSON验证
    // 但可以检查内容是否为空
    if (config.content === '' || config.content === null || config.content === undefined) {
      warnings.push({
        level: 'warning',
        code: 'EMPTY_MARKDOWN',
        file: fileName,
        message: `${fileName} 内容为空`,
        suggestion: '请添加必要的文档内容'
      });
    }

    return { errors, warnings, security: [] };
  }

  /**
   * 验证通用JSON配置
   */
  validateGenericConfig(config, fileName) {
    const errors = [];
    const warnings = [];

    // ⚠️ WARN级别：推荐字段检查
    const recommendedFields = ['meta', 'version', 'name'];
    for (const field of recommendedFields) {
      if (!config[field]) {
        warnings.push({
          level: 'warning',
          code: 'MISSING_RECOMMENDED_FIELD',
          file: fileName,
          field: field,
          message: `[${fileName}] 缺少推荐字段: ${field}`,
          suggestion: `建议添加"${field}"字段`
        });
      }
    }

    return { errors, warnings, security: [] };
  }

  /**
   * 安全检查
   */
  async validateSecurity(config, fileName, filePath) {
    const security = [];

    try {
      // 检查文件权限
      const stats = await fs.stat(filePath);
      const mode = stats.mode;

      // 检查文件是否对其他用户可写（Unix系统）
      if (process.platform !== 'win32') {
        if (mode & 0o002) {
          security.push({
            level: 'warning',
            code: 'WORLD_WRITABLE_FILE',
            file: fileName,
            message: `[${fileName}] 配置文件对其他用户可写，存在安全风险`,
            suggestion: '建议修改文件权限：chmod 600 ' + filePath
          });
        }
      }

      // 检查文件是否包含敏感信息
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const sensitivePatterns = [
        { pattern: /password\s*[:=]\s*["'][^"']+["']/i, name: 'password' },
        { pattern: /secret\s*[:=]\s*["'][^"']+["']/i, name: 'secret' },
        { pattern: /api[_-]?key\s*[:=]\s*["'][^"']+["']/i, name: 'api key' },
        { pattern: /token\s*[:=]\s*["'][^"']+["']/i, name: 'token' }
      ];

      for (const { pattern, name } of sensitivePatterns) {
        if (pattern.test(fileContent)) {
          // 检查是否明文存储
          if (!filePath.endsWith('.enc') && !filePath.includes('encrypted')) {
            security.push({
              level: 'warning',
              code: 'SENSITIVE_DATA_EXPOSURE',
              file: fileName,
              dataType: name,
              message: `[${fileName}] 配置文件可能包含明文存储的${name}`,
              suggestion: '建议使用加密存储或环境变量'
            });
          }
        }
      }
    } catch (error) {
      // 忽略文件读取错误
    }

    return security;
  }

  /**
   * 批量验证多个配置
   */
  async validateConfigs(configs) {
    const results = [];
    let totalErrors = 0;
    let totalWarnings = 0;
    let totalSecurity = 0;

    for (const config of configs) {
      const result = await this.validateConfig(
        config.config,
        config.fileName,
        config.filePath
      );

      results.push({
        fileName: config.fileName,
        filePath: config.filePath,
        ...result
      });

      totalErrors += result.summary.errorCount;
      totalWarnings += result.summary.warningCount;
      totalSecurity += result.summary.securityCount;
    }

    return {
      results,
      summary: {
        totalFiles: configs.length,
        totalErrors,
        totalWarnings,
        totalSecurity,
        totalIssues: totalErrors + totalWarnings + totalSecurity,
        hasErrors: totalErrors > 0,
        hasWarnings: totalWarnings > 0,
        hasSecurity: totalSecurity > 0
      }
    };
  }
}

module.exports = new ConfigValidationService();
