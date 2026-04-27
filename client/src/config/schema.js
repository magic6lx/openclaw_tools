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
        useProxy: {
          type: 'boolean',
          title: '使用代理',
          default: false,
          description: '使用邀请码管理员配置的API Key'
        },
        providers: {
          type: 'object',
          title: '模型提供商',
          default: {}
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
              title: '可用模型',
              default: {}
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
            },
            skills: {
              type: 'array',
              title: '技能列表',
              items: { type: 'string' },
              default: []
            },
            sandbox: {
              type: 'object',
              title: '沙箱配置',
              properties: {
                mode: {
                  type: 'string',
                  title: '沙箱模式',
                  enum: ['off', 'non-main', 'all'],
                  default: 'off'
                },
                scope: {
                  type: 'string',
                  title: '沙箱范围',
                  enum: ['session', 'agent', 'shared'],
                  default: 'agent'
                }
              }
            },
            heartbeat: {
              type: 'object',
              title: '心跳配置',
              properties: {
                every: {
                  type: 'string',
                  title: '心跳间隔',
                  default: '30m'
                },
                target: {
                  type: 'string',
                  title: '心跳目标',
                  enum: ['last', 'none'],
                  default: 'last'
                }
              }
            },
            canvas: {
              type: 'object',
              title: '画布配置',
              properties: {
                enabled: {
                  type: 'boolean',
                  title: '启用画布',
                  default: false
                },
                persistence: {
                  type: 'string',
                  title: '持久化方式',
                  enum: ['memory', 'file', 'database'],
                  default: 'file'
                }
              }
            }
          }
        },
        list: {
          type: 'array',
          title: 'Agent 列表',
          items: {
            type: 'object',
            title: 'Agent',
            properties: {
              id: { type: 'string', title: 'Agent ID' },
              name: { type: 'string', title: '名称' },
              model: { type: 'string', title: '模型' },
              isDefault: { type: 'boolean', title: '默认', default: false },
              description: { type: 'string', title: '描述' },
              skills: {
                type: 'array',
                title: '技能',
                items: { type: 'string' },
                default: []
              },
              enabled: { type: 'boolean', title: '启用', default: true }
            }
          }
        }
      }
    },
    launcher: {
      type: 'object',
      title: '启动器配置',
      properties: {
        autoStart: {
          type: 'boolean',
          title: '开机自启',
          default: false
        },
        checkUpdate: {
          type: 'boolean',
          title: '自动检查更新',
          default: true
        },
        logLevel: {
          type: 'string',
          title: '日志级别',
          enum: ['debug', 'info', 'warn', 'error'],
          default: 'info'
        }
      }
    },
    gateway: {
      type: 'object',
      title: '网关配置',
      properties: {
        enabled: {
          type: 'boolean',
          title: '启用网关',
          default: true
        },
        port: {
          type: 'integer',
          title: '端口',
          default: 18789,
          minimum: 1024,
          maximum: 65535
        },
        controlUi: {
          type: 'object',
          title: '控制面板',
          properties: {
            enabled: {
              type: 'boolean',
              title: '启用控制面板',
              default: true
            },
            allowInsecureAuth: {
              type: 'boolean',
              title: '允许不安全认证',
              default: false,
              dangerous: true
            }
          }
        },
        channelHealthCheckMinutes: {
          type: 'integer',
          title: '通道健康检查间隔(分钟)',
          default: 5,
          minimum: 0
        }
      }
    },
    session: {
      type: 'object',
      title: '会话配置',
      properties: {
        dmScope: {
          type: 'string',
          title: 'DM范围',
          enum: ['per-channel-peer', 'global'],
          default: 'per-channel-peer'
        },
        threadBindings: {
          type: 'object',
          title: '线程绑定',
          properties: {
            enabled: {
              type: 'boolean',
              title: '启用',
              default: true
            },
            idleHours: {
              type: 'integer',
              title: '空闲小时数',
              default: 24
            }
          }
        },
        reset: {
          type: 'object',
          title: '重置配置',
          properties: {
            mode: {
              type: 'string',
              title: '重置模式',
              enum: ['off', 'at'],
              default: 'off'
            },
            atHour: {
              type: 'integer',
              title: '重置小时',
              default: 4
            }
          }
        }
      }
    },
    channels: {
      type: 'object',
      title: '频道配置',
      properties: {
        whatsapp: {
          type: 'object',
          title: 'WhatsApp',
          properties: {
            enabled: { type: 'boolean', title: '启用', default: false },
            dmPolicy: {
              type: 'string',
              title: 'DM策略',
              enum: ['pairing', 'allowlist', 'open', 'disabled'],
              default: 'pairing'
            },
            allowFrom: {
              type: 'array',
              title: '允许列表',
              items: { type: 'string' },
              default: []
            }
          }
        },
        telegram: {
          type: 'object',
          title: 'Telegram',
          properties: {
            enabled: { type: 'boolean', title: '启用', default: false },
            botToken: { type: 'string', title: 'Bot Token', sensitive: true },
            dmPolicy: {
              type: 'string',
              title: 'DM策略',
              enum: ['pairing', 'allowlist', 'open', 'disabled'],
              default: 'pairing'
            }
          }
        },
        discord: {
          type: 'object',
          title: 'Discord',
          properties: {
            enabled: { type: 'boolean', title: '启用', default: false },
            token: { type: 'string', title: 'Token', sensitive: true },
            voice: {
              type: 'object',
              title: '语音',
              properties: {
                enabled: { type: 'boolean', title: '启用', default: false }
              }
            }
          }
        },
        slack: {
          type: 'object',
          title: 'Slack',
          properties: {
            enabled: { type: 'boolean', title: '启用', default: false },
            botToken: { type: 'string', title: 'Bot Token', sensitive: true },
            appToken: { type: 'string', title: 'App Token', sensitive: true }
          }
        }
      }
    },
    hooks: {
      type: 'object',
      title: '钩子配置',
      properties: {
        preTask: {
          type: 'array',
          title: '任务前钩子',
          items: { type: 'string' }
        },
        postTask: {
          type: 'array',
          title: '任务后钩子',
          items: { type: 'string' }
        }
      }
    }
  }
};

export const SECTION_META = {
  launcher: { icon: '�', order: 1, category: '基础服务' },
  gateway: { icon: '🌉', order: 2, category: '基础服务' },
  agents: { icon: '🤖', order: 3, category: '核心配置' },
  session: { icon: '💬', order: 4, category: '核心配置' },
  models: { icon: '🧠', order: 5, category: '模型' },
  channels: { icon: '�', order: 6, category: '集成' },
  hooks: { icon: '🔗', order: 7, category: '集成' },
  logging: { icon: '�', order: 8, category: '调试' },
  browser: { icon: '🌐', order: 9, category: '调试' },
  meta: { icon: '�', order: 10, category: '元信息' },
  wizard: { icon: '🧙', order: 11, category: '元信息' }
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
