export const CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    meta: {
      type: 'object',
      title: '配置元信息',
      properties: {
        lastTouchedVersion: {
          type: 'string',
          title: '最后修改版本',
          default: ''
        },
        lastTouchedAt: {
          type: 'string',
          title: '最后修改时间',
          default: ''
        }
      }
    },
    wizard: {
      type: 'object',
      title: '向导配置',
      properties: {
        lastRunAt: { type: 'string', title: '最后运行时间' },
        lastRunVersion: { type: 'string', title: '最后运行版本' },
        lastRunCommand: { type: 'string', title: '最后运行命令' },
        lastRunMode: { type: 'string', title: '运行模式' }
      }
    },
    logging: {
      type: 'object',
      title: '日志配置',
      properties: {
        level: {
          type: 'string',
          title: '日志级别',
          enum: ['debug', 'info', 'warn', 'error'],
          default: 'info'
        },
        file: {
          type: 'string',
          title: '日志文件路径',
          default: ''
        },
        consoleLevel: {
          type: 'string',
          title: '控制台日志级别',
          enum: ['debug', 'info', 'warn', 'error'],
          default: 'debug'
        },
        consoleStyle: {
          type: 'string',
          title: '控制台样式',
          enum: ['pretty', 'json'],
          default: 'pretty'
        }
      }
    },
    browser: {
      type: 'object',
      title: '浏览器配置',
      properties: {
        enabled: {
          type: 'boolean',
          title: '启用浏览器',
          default: true
        },
        executablePath: {
          type: 'string',
          title: '浏览器路径',
          default: ''
        },
        defaultProfile: {
          type: 'string',
          title: '默认配置文件',
          default: 'user'
        }
      }
    },
    models: {
      type: 'object',
      title: '模型配置',
      properties: {
        providers: {
          type: 'object',
          title: '模型提供商'
        }
      }
    },
    agents: {
      type: 'object',
      title: 'Agent 配置',
      properties: {
        defaults: {
          type: 'object',
          title: '默认配置',
          properties: {
            model: {
              type: 'object',
              title: '默认模型',
              properties: {
                primary: {
                  type: 'string',
                  title: '主模型',
                  default: ''
                }
              }
            },
            models: {
              type: 'object',
              title: '可用模型'
            },
            workspace: {
              type: 'string',
              title: '默认工作空间',
              default: ''
            },
            contextTokens: {
              type: 'integer',
              title: '上下文令牌数',
              default: 100000,
              minimum: 1000,
              maximum: 1000000
            },
            maxConcurrent: {
              type: 'integer',
              title: '最大并发数',
              default: 4,
              minimum: 1,
              maximum: 32
            },
            typingMode: {
              type: 'string',
              title: '输入模式',
              enum: ['never', 'direct', 'e2e'],
              default: 'never'
            }
          }
        },
        list: {
          type: 'array',
          title: 'Agent 列表',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', title: 'Agent ID' },
              name: { type: 'string', title: '名称' },
              model: { type: 'string', title: '模型' },
              default: { type: 'boolean', title: '默认' }
            }
          }
        }
      }
    },
    tools: {
      type: 'object',
      title: '工具配置',
      properties: {
        profile: {
          type: 'string',
          title: '工具配置',
          enum: ['minimal', 'standard', 'full'],
          default: 'full'
        },
        agentToAgent: {
          type: 'object',
          title: 'Agent间通信'
        }
      }
    },
    skills: {
      type: 'object',
      title: '技能配置'
    },
    channels: {
      type: 'object',
      title: '频道配置'
    },
    hooks: {
      type: 'object',
      title: '钩子配置'
    },
    canvas: {
      type: 'object',
      title: '画布配置'
    },
    sandbox: {
      type: 'object',
      title: '沙箱配置'
    }
  }
};

export const SECTION_META = {
  meta: { icon: '📋', order: 1, category: '元信息' },
  wizard: { icon: '🧙', order: 2, category: '元信息' },
  logging: { icon: '📝', order: 3, category: '日志' },
  browser: { icon: '🌐', order: 4, category: '浏览器' },
  models: { icon: '🧠', order: 5, category: '模型' },
  agents: { icon: '🤖', order: 6, category: '核心' },
  tools: { icon: '🔧', order: 7, category: '工具' },
  skills: { icon: '💡', order: 8, category: '技能' },
  channels: { icon: '📱', order: 9, category: '频道' },
  hooks: { icon: '🔗', order: 10, category: '集成' },
  canvas: { icon: '🎨', order: 11, category: '画布' },
  sandbox: { icon: '📦', order: 12, category: '沙箱' }
};

export function getSchemaSection(section) {
  return CONFIG_SCHEMA.properties[section];
}

export function getSchemaField(section, field) {
  const sec = getSchemaSection(section);
  return sec?.properties?.[field];
}

export function getDefaultValue(section, field) {
  const fieldSchema = getSchemaField(section, field);
  return fieldSchema?.default;
}

export function validateConfigValue(section, field, value) {
  const fieldSchema = getSchemaField(section, field);
  if (!fieldSchema) return { valid: true };

  const errors = [];

  if (fieldSchema.type === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      errors.push('必须是整数');
    } else {
      if (fieldSchema.minimum !== undefined && value < fieldSchema.minimum) {
        errors.push(`最小值为 ${fieldSchema.minimum}`);
      }
      if (fieldSchema.maximum !== undefined && value > fieldSchema.maximum) {
        errors.push(`最大值为 ${fieldSchema.maximum}`);
      }
    }
  }

  if (fieldSchema.type === 'boolean' && typeof value !== 'boolean') {
    errors.push('必须是布尔值');
  }

  if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
    errors.push(`必须是以下值之一: ${fieldSchema.enum.join(', ')}`);
  }

  if (fieldSchema.type === 'string' && typeof value !== 'string') {
    errors.push('必须是字符串');
  }

  if (fieldSchema.type === 'array' && !Array.isArray(value)) {
    errors.push('必须是数组');
  }

  return { valid: errors.length === 0, errors };
}

export function validateConfig(config) {
  const errors = [];

  function validateObject(obj, schema, path = '') {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      const fieldSchema = schema?.properties?.[key];
      if (!fieldSchema) continue;

      const currentPath = path ? `${path}.${key}` : key;

      if (fieldSchema.type === 'object' && typeof value === 'object') {
        validateObject(value, fieldSchema, currentPath);
      } else {
        const result = validateConfigValue(path, key, value);
        if (!result.valid) {
          errors.push({
            path: currentPath,
            errors: result.errors
          });
        }
      }
    }
  }

  validateObject(config, CONFIG_SCHEMA);
  return { valid: errors.length === 0, errors };
}
