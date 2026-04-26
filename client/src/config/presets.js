export const CONFIG_PRESETS = [
  {
    id: 'minimal',
    label: '最小配置',
    description: '仅基础启动配置',
    icon: '⚡',
    category: '基础',
    config: {
      launcher: {
        autoStart: false,
        checkUpdate: true,
        logLevel: 'info'
      },
      gateway: {
        enabled: true,
        port: 18789
      }
    }
  },
  {
    id: 'standard',
    label: '标准配置',
    description: '包含智能体和会话管理',
    icon: '🎯',
    category: '推荐',
    config: {
      launcher: {
        autoStart: false,
        checkUpdate: true,
        logLevel: 'info'
      },
      gateway: {
        enabled: true,
        port: 18789,
        controlUi: {
          enabled: true,
          allowInsecureAuth: false
        },
        channelHealthCheckMinutes: 5
      },
      agents: {
        defaults: {
          workspace: '~/.openclaw/workspace',
          model: {
            primary: 'anthropic/claude-sonnet-4-6',
            fallbacks: []
          },
          skills: [],
          sandbox: {
            mode: 'off',
            scope: 'agent'
          },
          heartbeat: {
            every: '30m',
            target: 'last'
          }
        }
      },
      session: {
        dmScope: 'per-channel-peer',
        threadBindings: {
          enabled: true,
          idleHours: 24
        },
        reset: {
          mode: 'off',
          atHour: 4
        }
      }
    }
  },
  {
    id: 'multi-channel',
    label: '多通道配置',
    description: '启用多个消息平台',
    icon: '📱',
    category: '高级',
    config: {
      launcher: {
        autoStart: false,
        checkUpdate: true,
        logLevel: 'info'
      },
      gateway: {
        enabled: true,
        port: 18789,
        controlUi: {
          enabled: true,
          allowInsecureAuth: false
        },
        channelHealthCheckMinutes: 5
      },
      agents: {
        defaults: {
          workspace: '~/.openclaw/workspace',
          model: {
            primary: 'anthropic/claude-sonnet-4-6',
            fallbacks: ['openai/gpt-4.1']
          },
          skills: [],
          sandbox: {
            mode: 'off',
            scope: 'agent'
          }
        }
      },
      channels: {
        whatsapp: {
          enabled: false,
          dmPolicy: 'pairing',
          allowFrom: []
        },
        telegram: {
          enabled: false,
          botToken: '',
          dmPolicy: 'pairing'
        },
        discord: {
          enabled: false,
          token: '',
          voice: {
            enabled: false
          }
        },
        slack: {
          enabled: false,
          botToken: '',
          appToken: ''
        }
      },
      session: {
        dmScope: 'per-channel-peer',
        threadBindings: {
          enabled: true,
          idleHours: 24
        }
      }
    }
  },
  {
    id: 'automation',
    label: '自动化配置',
    description: '启用定时任务和Webhooks',
    icon: '🤖',
    category: '高级',
    config: {
      launcher: {
        autoStart: true,
        checkUpdate: true,
        logLevel: 'info'
      },
      gateway: {
        enabled: true,
        port: 18789
      },
      agents: {
        defaults: {
          workspace: '~/.openclaw/workspace',
          model: {
            primary: 'anthropic/claude-sonnet-4-6',
            fallbacks: []
          },
          skills: ['github', 'weather']
        }
      },
      hooks: {
        enabled: true,
        token: '',
        path: '/hooks'
      },
      cron: {
        enabled: true,
        maxConcurrentRuns: 2,
        sessionRetention: '24h'
      },
      tools: {
        exec: {
          enabled: true,
          applyPatch: {
            workspaceOnly: true
          }
        }
      }
    }
  },
  {
    id: 'secure',
    label: '安全配置',
    description: '启用沙箱和密钥管理',
    icon: '🔒',
    category: '企业',
    config: {
      launcher: {
        autoStart: false,
        checkUpdate: true,
        logLevel: 'warn'
      },
      gateway: {
        enabled: true,
        port: 18789,
        controlUi: {
          enabled: true,
          allowInsecureAuth: false
        }
      },
      agents: {
        defaults: {
          workspace: '~/.openclaw/workspace',
          model: {
            primary: 'anthropic/claude-sonnet-4-6',
            fallbacks: []
          },
          sandbox: {
            mode: 'non-main',
            scope: 'agent'
          }
        }
      },
      secrets: {
        providers: {
          default: {
            source: 'env'
          }
        }
      },
      tools: {
        exec: {
          enabled: true,
          applyPatch: {
            workspaceOnly: true
          }
        }
      }
    }
  }
];

export function getPresetById(id) {
  return CONFIG_PRESETS.find(p => p.id === id);
}

export function getDefaultConfig() {
  const standard = getPresetById('standard');
  return standard ? standard.config : CONFIG_PRESETS[0].config;
}

export function getPresetsByCategory(category) {
  return CONFIG_PRESETS.filter(p => p.category === category);
}

export function getAllCategories() {
  const categories = [...new Set(CONFIG_PRESETS.map(p => p.category))];
  return categories.sort((a, b) => {
    const order = { '推荐': 1, '基础': 2, '高级': 3, '企业': 4 };
    return (order[a] || 99) - (order[b] || 99);
  });
}

export function mergeConfig(baseConfig, overrideConfig) {
  const merged = JSON.parse(JSON.stringify(baseConfig));
  
  function deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  
  deepMerge(merged, overrideConfig);
  return merged;
}

export function extractConfigDiff(fullConfig, baseConfig) {
  const diff = {};
  
  function extractDiff(full, base, result) {
    for (const key in full) {
      if (!(key in base)) {
        result[key] = full[key];
      } else if (typeof full[key] === 'object' && !Array.isArray(full[key])) {
        if (typeof base[key] === 'object' && !Array.isArray(base[key])) {
          const nestedDiff = {};
          extractDiff(full[key], base[key], nestedDiff);
          if (Object.keys(nestedDiff).length > 0) {
            result[key] = nestedDiff;
          }
        } else {
          result[key] = full[key];
        }
      } else if (JSON.stringify(full[key]) !== JSON.stringify(base[key])) {
        result[key] = full[key];
      }
    }
  }
  
  extractDiff(fullConfig, baseConfig, diff);
  return diff;
}
