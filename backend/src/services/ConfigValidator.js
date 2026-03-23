class ConfigValidator {
  validateConfigStructure(config) {
    const errors = [];
    const warnings = [];

    if (!config || typeof config !== 'object') {
      errors.push('配置必须是有效的JSON对象');
      return { valid: false, errors, warnings };
    }

    if (Object.keys(config).length === 0) {
      warnings.push('配置对象为空');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  validateConfigFields(config, schema) {
    const errors = [];
    const warnings = [];

    for (const field in schema) {
      const fieldSchema = schema[field];
      const value = config[field];

      if (fieldSchema.required && (value === undefined || value === null)) {
        errors.push(`必填字段 "${field}" 缺失`);
        continue;
      }

      if (value !== undefined && value !== null) {
        if (fieldSchema.type && typeof value !== fieldSchema.type) {
          errors.push(`字段 "${field}" 类型错误，期望 ${fieldSchema.type}，实际 ${typeof value}`);
        }

        if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
          errors.push(`字段 "${field}" 值无效，可选值: ${fieldSchema.enum.join(', ')}`);
        }

        if (fieldSchema.min !== undefined && value < fieldSchema.min) {
          errors.push(`字段 "${field}" 值小于最小值 ${fieldSchema.min}`);
        }

        if (fieldSchema.max !== undefined && value > fieldSchema.max) {
          errors.push(`字段 "${field}" 值大于最大值 ${fieldSchema.max}`);
        }

        if (fieldSchema.pattern && !fieldSchema.pattern.test(value)) {
          errors.push(`字段 "${field}" 格式不匹配`);
        }
      }
    }

    for (const field in config) {
      if (!schema[field]) {
        warnings.push(`未知字段 "${field}"`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  validateConfigValues(config) {
    const errors = [];
    const warnings = [];

    if (config.timeout) {
      if (config.timeout < 0) {
        errors.push('timeout 不能为负数');
      }
      if (config.timeout > 3600000) {
        warnings.push('timeout 值较大，可能导致长时间等待');
      }
    }

    if (config.max_retries) {
      if (config.max_retries < 0) {
        errors.push('max_retries 不能为负数');
      }
      if (config.max_retries > 10) {
        warnings.push('max_retries 值较大，建议不超过10');
      }
    }

    if (config.memory_limit) {
      if (config.memory_limit < 0) {
        errors.push('memory_limit 不能为负数');
      }
      if (config.memory_limit > 8589934592) {
        warnings.push('memory_limit 超过8GB，可能影响系统性能');
      }
    }

    if (config.cpu_limit) {
      if (config.cpu_limit < 0) {
        errors.push('cpu_limit 不能为负数');
      }
      if (config.cpu_limit > 1) {
        warnings.push('cpu_limit 超过1.0，可能影响系统性能');
      }
    }

    if (config.enable_logging && config.log_level) {
      const validLogLevels = ['debug', 'info', 'warn', 'error'];
      if (!validLogLevels.includes(config.log_level)) {
        errors.push(`log_level 无效，可选值: ${validLogLevels.join(', ')}`);
      }
    }

    if (config.api_key) {
      if (typeof config.api_key !== 'string' || config.api_key.length < 16) {
        warnings.push('api_key 长度较短，建议使用更长的密钥');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  validateConfigCompatibility(config, environment) {
    const errors = [];
    const warnings = [];

    if (!environment) {
      return { valid: true, errors, warnings };
    }

    if (environment.os_type) {
      if (config.os_specific && config.os_specific[environment.os_type]) {
        const osConfig = config.os_specific[environment.os_type];
        const osValidation = this.validateConfigValues(osConfig);
        errors.push(...osValidation.errors);
        warnings.push(...osValidation.warnings);
      }
    }

    if (environment.hardware_info) {
      const hardware = typeof environment.hardware_info === 'string' 
        ? JSON.parse(environment.hardware_info) 
        : environment.hardware_info;

      if (config.requirements) {
        if (config.requirements.min_memory && hardware.memory) {
          const minMemory = config.requirements.min_memory * 1024 * 1024 * 1024;
          if (hardware.memory < minMemory) {
            errors.push(`内存不足，需要至少 ${config.requirements.min_memory}GB`);
          }
        }

        if (config.requirements.min_cpu_cores && hardware.cpu && hardware.cpu.cores) {
          if (hardware.cpu.cores < config.requirements.min_cpu_cores) {
            errors.push(`CPU核心数不足，需要至少 ${config.requirements.min_cpu_cores} 核`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  validateConfigSecurity(config) {
    const errors = [];
    const warnings = [];

    if (config.api_key) {
      if (config.api_key === 'default' || config.api_key === 'test') {
        errors.push('使用默认或测试API密钥存在安全风险');
      }
    }

    if (config.enable_ssl !== undefined && !config.enable_ssl) {
      warnings.push('SSL未启用，数据传输可能不安全');
    }

    if (config.allow_cors && config.allow_cors === '*') {
      warnings.push('CORS配置为*，可能存在安全风险');
    }

    if (config.debug_mode) {
      warnings.push('调试模式已启用，生产环境应关闭');
    }

    if (config.log_sensitive_data) {
      errors.push('记录敏感数据存在安全风险');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  validateConfig(config, options = {}) {
    const { schema, environment, checkSecurity = true } = options;

    const structureResult = this.validateConfigStructure(config);
    const valuesResult = this.validateConfigValues(config);
    const compatibilityResult = this.validateConfigCompatibility(config, environment);
    const securityResult = checkSecurity ? this.validateConfigSecurity(config) : { valid: true, errors: [], warnings: [] };

    let schemaResult = { valid: true, errors: [], warnings: [] };
    if (schema) {
      schemaResult = this.validateConfigFields(config, schema);
    }

    const allErrors = [
      ...structureResult.errors,
      ...valuesResult.errors,
      ...compatibilityResult.errors,
      ...securityResult.errors,
      ...schemaResult.errors
    ];

    const allWarnings = [
      ...structureResult.warnings,
      ...valuesResult.warnings,
      ...compatibilityResult.warnings,
      ...securityResult.warnings,
      ...schemaResult.warnings
    ];

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      details: {
        structure: structureResult,
        values: valuesResult,
        compatibility: compatibilityResult,
        security: securityResult,
        schema: schemaResult
      }
    };
  }

  getDefaultSchema() {
    return {
      name: { type: 'string', required: true },
      version: { type: 'string', required: true },
      timeout: { type: 'number', min: 0, max: 3600000 },
      max_retries: { type: 'number', min: 0, max: 10 },
      memory_limit: { type: 'number', min: 0 },
      cpu_limit: { type: 'number', min: 0, max: 1 },
      enable_logging: { type: 'boolean' },
      log_level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
      api_key: { type: 'string' },
      enable_ssl: { type: 'boolean' },
      debug_mode: { type: 'boolean' }
    };
  }
}

module.exports = new ConfigValidator();