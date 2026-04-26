const CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    launcher: {
      type: 'object',
      title: '启动器配置',
      description: '启动器基本设置',
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
      description: '网关服务器设置',
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
    agents: {
      type: 'object',
      title: '智能体配置',
      description: 'AI智能体核心配置',
      properties: {
        defaults: {
          type: 'object',
          title: '默认配置',
          properties: {
            workspace: {
              type: 'string',
              title: '工作空间路径',
              default: '~/.openclaw/workspace'
            },
            model: {
              type: 'object',
              title: '模型配置',
              properties: {
                primary: {
                  type: 'string',
                  title: '主模型',
                  default: 'anthropic/claude-sonnet-4-6'
                },
                fallbacks: {
                  type: 'array',
                  title: '备用模型',
                  items: { type: 'string' },
                  default: []
                }
              }
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
            }
          }
        }
      }
    },
    channels: {
      type: 'object',
      title: '消息通道',
      description: '多平台消息通道配置',
      properties: {
        whatsapp: {
          type: 'object',
          title: 'WhatsApp',
          properties: {
            enabled: {
              type: 'boolean',
              title: '启用',
              default: false
            },
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
            enabled: {
              type: 'boolean',
              title: '启用',
              default: false
            },
            botToken: {
              type: 'string',
              title: 'Bot Token',
              sensitive: true
            },
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
            enabled: {
              type: 'boolean',
              title: '启用',
              default: false
            },
            token: {
              type: 'string',
              title: 'Bot Token',
              sensitive: true
            },
            voice: {
              type: 'object',
              title: '语音配置',
              properties: {
                enabled: {
                  type: 'boolean',
                  title: '启用语音',
                  default: false
                }
              }
            }
          }
        },
        slack: {
          type: 'object',
          title: 'Slack',
          properties: {
            enabled: {
              type: 'boolean',
              title: '启用',
              default: false
            },
            botToken: {
              type: 'string',
              title: 'Bot Token',
              sensitive: true
            },
            appToken: {
              type: 'string',
              title: 'App Token',
              sensitive: true
            }
          }
        }
      }
    },
    tools: {
      type: 'object',
      title: '工具配置',
      description: '扩展工具配置',
      properties: {
        exec: {
          type: 'object',
          title: '执行工具',
          properties: {
            enabled: {
              type: 'boolean',
              title: '启用执行',
              default: true
            },
            applyPatch: {
              type: 'object',
              title: '补丁应用',
              properties: {
                workspaceOnly: {
                  type: 'boolean',
                  title: '仅工作空间',
                  default: true
                }
              }
            }
          }
        },
        browser: {
          type: 'object',
          title: '浏览器',
          properties: {
            enabled: {
              type: 'boolean',
              title: '启用浏览器',
              default: false
            },
            executablePath: {
              type: 'string',
              title: '浏览器路径'
            },
            headless: {
              type: 'boolean',
              title: '无头模式',
              default: true
            }
          }
        }
      }
    },
    session: {
      type: 'object',
      title: '会话管理',
      description: '对话持久化配置',
      properties: {
        dmScope: {
          type: 'string',
          title: 'DM范围',
          enum: ['main', 'per-peer', 'per-channel-peer', 'per-account-channel-peer'],
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
              title: '空闲超时(小时)',
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
              enum: ['off', 'daily', 'weekly'],
              default: 'off'
            },
            atHour: {
              type: 'integer',
              title: '重置时间(小时)',
              default: 4,
              minimum: 0,
              maximum: 23
            }
          }
        }
      }
    },
    hooks: {
      type: 'object',
      title: 'Webhooks',
      description: '外部集成配置',
      properties: {
        enabled: {
          type: 'boolean',
          title: '启用',
          default: false
        },
        token: {
          type: 'string',
          title: '认证Token',
          sensitive: true
        },
        path: {
          type: 'string',
          title: 'Webhook路径',
          default: '/hooks'
        }
      }
    },
    cron: {
      type: 'object',
      title: '定时任务',
      description: '自动化任务配置',
      properties: {
        enabled: {
          type: 'boolean',
          title: '启用',
          default: false
        },
        maxConcurrentRuns: {
          type: 'integer',
          title: '最大并发数',
          default: 2,
          minimum: 1
        },
        sessionRetention: {
          type: 'string',
          title: '会话保留时间',
          default: '24h'
        }
      }
    },
    secrets: {
      type: 'object',
      title: '密钥管理',
      description: '安全配置',
      properties: {
        providers: {
          type: 'object',
          title: '密钥提供者',
          properties: {
            default: {
              type: 'object',
              title: '默认提供者',
              properties: {
                source: {
                  type: 'string',
                  title: '来源',
                  enum: ['env', 'file', 'exec'],
                  default: 'env'
                }
              }
            }
          }
        }
      }
    },
    plugins: {
      type: 'object',
      title: '插件系统',
      description: '扩展插件配置',
      properties: {
        entries: {
          type: 'object',
          title: '插件列表',
          additionalProperties: {
            type: 'object',
            properties: {
              config: {
                type: 'object',
                title: '插件配置'
              }
            }
          }
        }
      }
    }
  }
};

const SECTION_META = {
  launcher: { icon: '🚀', order: 1, category: '基础' },
  gateway: { icon: '🌐', order: 2, category: '基础' },
  agents: { icon: '🤖', order: 3, category: '核心' },
  channels: { icon: '📱', order: 4, category: '核心' },
  tools: { icon: '🔧', order: 5, category: '扩展' },
  session: { icon: '💬', order: 6, category: '核心' },
  hooks: { icon: '🔗', order: 7, category: '集成' },
  cron: { icon: '⏰', order: 8, category: '自动化' },
  secrets: { icon: '🔐', order: 9, category: '安全' },
  plugins: { icon: '🔌', order: 10, category: '扩展' }
};

module.exports = { CONFIG_SCHEMA, SECTION_META };
