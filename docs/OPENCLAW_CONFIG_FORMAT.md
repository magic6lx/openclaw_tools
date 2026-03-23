# OpenClaw配置文件格式说明

## 配置文件格式

配置文件采用 **JSON** 格式，必须是一个有效的JSON对象。

## OpenClaw完整配置结构

```json
{
  "meta": { ... },
  "logging": { ... },
  "browser": { ... },
  "auth": { ... },
  "models": { ... },
  "agents": { ... },
  "tools": { ... },
  "bindings": [ ... ],
  "messages": { ... },
  "commands": { ... },
  "session": { ... },
  "channels": { ... },
  "gateway": { ... },
  "memory": { ... },
  "skills": { ... }
}
```

## 字段详细说明

### 1. 基础配置（meta）

```json
{
  "meta": {
    "lastTouchedVersion": "2026.3.13",
    "lastTouchedAt": "2026-03-16T07:56:35.298Z"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|--------|------|
| `lastTouchedVersion` | string | 是 | 最后修改的OpenClaw版本 |
| `lastTouchedAt` | string | 是 | 最后修改时间（ISO 8601格式） |

### 2. 日志配置（logging）

```json
{
  "logging": {
    "level": "debug",
    "file": "D:\\Projects\\workspace\\.openclaw\\logs\\openclaw-2026.log",
    "maxFileBytes": 52428800,
    "consoleLevel": "debug",
    "consoleStyle": "pretty"
  }
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|--------|----------|------|
| `level` | string | "info" | 日志级别：debug、info、warn、error |
| `file` | string | - | 日志文件路径 |
| `maxFileBytes` | number | 52428800 | 最大文件大小（字节），默认50MB |
| `consoleLevel` | string | "info" | 控制台日志级别 |
| `consoleStyle` | string | "pretty" | 控制台样式：pretty、json |

### 3. 浏览器配置（browser）

```json
{
  "browser": {
    "enabled": true,
    "evaluateEnabled": true,
    "executablePath": "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "defaultProfile": "user",
    "profiles": {
      "openclaw": {
        "cdpPort": 9222,
        "color": "#FF4500"
      },
      "user": {
        "cdpPort": 9223,
        "color": "#00FF00"
      }
    }
  }
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|--------|----------|------|
| `enabled` | boolean | true | 是否启用浏览器 |
| `evaluateEnabled` | boolean | true | 是否启用JavaScript执行 |
| `executablePath` | string | - | 浏览器可执行文件路径 |
| `defaultProfile` | string | "user" | 默认配置文件 |
| `profiles` | object | - | 浏览器配置文件列表 |
| `profiles.{name}.cdpPort` | number | - | Chrome DevTools协议端口 |
| `profiles.{name}.color` | string | - | 配置文件颜色标识 |

### 4. 认证配置（auth）

```json
{
  "auth": {
    "profiles": {
      "volcengine:default": {
        "provider": "volcengine",
        "mode": "api_key"
      }
    }
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|--------|------|
| `profiles` | object | - | 认证配置文件列表 |
| `profiles.{name}.provider` | string | - | 提供商：volcengine、openai等 |
| `profiles.{name}.mode` | string | - | 认证模式：api_key、oauth等 |

### 5. 模型配置（models）

```json
{
  "models": {
    "providers": {
      "volcengine": {
        "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
        "apiKey": "your_api_key_here",
        "auth": "api-key",
        "api": "openai-completions",
        "models": []
      }
    }
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|--------|------|
| `providers` | object | - | 模型提供商列表 |
| `providers.{name}.baseUrl` | string | - | API基础URL |
| `providers.{name}.apiKey` | string | - | API密钥（敏感信息，模版中应剔除） |
| `providers.{name}.auth` | string | - | 认证方式：api-key、bearer等 |
| `providers.{name}.api` | string | - | API类型 |
| `providers.{name}.models` | array | - | 模型列表 |

### 6. Agent配置（agents）

```json
{
  "agents": {
    "defaults": {
      "workspace": "D:\\Projects\\workspace",
      "model": {
        "primary": "volcengine/doubao-seed-2-0-mini-260215"
      },
      "models": {
        "volcengine/doubao-seed-code-preview-251028": {},
        "volcengine/doubao-seed-2-0-mini-260215": {}
      },
      "contextTokens": 100000,
      "memorySearch": {
        "enabled": true,
        "provider": "gemini",
        "model": "text-embedding-004"
      },
      "contextPruning": {
        "mode": "cache-ttl",
        "ttl": "1h",
        "keepLastAssistants": 3
      },
      "compaction": {
        "mode": "safeguard",
        "reserveTokensFloor": 5000
      },
      "typingMode": "never",
      "heartbeat": {
        "every": "15m",
        "model": "volcengine/doubao-seed-1-8-251228",
        "session": "main",
        "includeReasoning": true
      },
      "subagents": {
        "maxConcurrent": 8,
        "maxSpawnDepth": 3,
        "runTimeoutSeconds": 600
      }
    },
    "list": [
      {
        "id": "orchestrator",
        "default": true,
        "name": "总调度",
        "model": "volcengine/doubao-seed-2-0-mini-260215",
        "subagents": {
          "allowAgents": ["*"]
        },
        "tools": {
          "allow": ["*"]
        }
      }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `defaults.workspace` | string | 工作空间路径 |
| `defaults.model.primary` | string | 主要模型 |
| `defaults.models` | object | 可用模型列表 |
| `defaults.contextTokens` | number | 上下文token限制 |
| `defaults.memorySearch` | object | 记忆搜索配置 |
| `defaults.contextPruning` | object | 上下文修剪配置 |
| `defaults.compaction` | object | 会话压缩配置 |
| `defaults.typingMode` | string | 打字模式：never、always、auto |
| `defaults.heartbeat` | object | 心跳配置 |
| `defaults.subagents` | object | 子Agent配置 |
| `list` | array | Agent列表 |
| `list[].id` | string | Agent ID |
| `list[].default` | boolean | 是否为默认Agent |
| `list[].name` | string | Agent名称 |
| `list[].model` | string | Agent使用的模型 |

### 7. 工具配置（tools）

```json
{
  "tools": {
    "profile": "full",
    "agentToAgent": {
      "enabled": true,
      "allow": ["*"]
    },
    "exec": {
      "host": "gateway",
      "security": "full",
      "ask": "on-miss"
    },
    "fs": {
      "workspaceOnly": false
    },
    "sessions_spawn": {
      "attachments": {
        "enabled": true
      }
    }
  }
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|--------|----------|------|
| `profile` | string | "full" | 工具配置文件：full、restricted等 |
| `agentToAgent.enabled` | boolean | true | Agent间通信是否启用 |
| `agentToAgent.allow` | array | ["*"] | 允许调用的Agent列表 |
| `exec.host` | string | "gateway" | 执行工具主机 |
| `exec.security` | string | "full" | 执行工具安全级别 |
| `exec.ask` | string | "on-miss" | 工具缺失时询问：on-miss、always、never |
| `fs.workspaceOnly` | boolean | false | 文件系统工具是否限制在工作空间 |
| `sessions_spawn.attachments.enabled` | boolean | true | 会话生成工具是否支持附件 |

### 8. 绑定配置（bindings）

```json
{
  "bindings": [
    {
      "type": "route",
      "agentId": "orchestrator",
      "match": {
        "channel": "discord",
        "accountId": "default"
      }
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | string | 绑定类型：route等 |
| `agentId` | string | Agent ID |
| `match.channel` | string | 渠道：discord、whatsapp等 |
| `match.accountId` | string | 账户ID |

### 9. 消息配置（messages）

```json
{
  "messages": {
    "queue": {
      "cap": 500,
      "drop": "old"
    },
    "inbound": {
      "debounceMs": 0
    },
    "ackReactionScope": "all"
  }
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|--------|----------|------|
| `queue.cap` | number | 500 | 队列容量 |
| `queue.drop` | string | "old" | 丢弃策略：old、new |
| `inbound.debounceMs` | number | 0 | 防抖延迟（毫秒） |
| `ackReactionScope` | string | "all" | 确认反应范围 |

### 10. 命令配置（commands）

```json
{
  "commands": {
    "native": "auto",
    "nativeSkills": "auto",
    "restart": false,
    "ownerDisplay": "raw"
  }
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|--------|----------|------|
| `native` | string | "auto" | 原生命令：auto、true、false |
| `nativeSkills` | string | "auto" | 原生技能：auto、true、false |
| `restart` | boolean | false | 是否允许重启 |
| `ownerDisplay` | string | "raw" | 所有者显示方式 |

### 11. 会话配置（session）

```json
{
  "session": {
    "dmScope": "per-channel-peer",
    "reset": {
      "mode": "daily"
    },
    "maintenance": {}
  }
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|--------|----------|------|
| `dmScope` | string | "per-channel-peer" | 私信范围 |
| `reset.mode` | string | "daily" | 重置模式：daily、never、manual |
| `maintenance` | object | - | 维护配置 |

### 12. 渠道配置（channels）

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "commands": {
        "native": false
      },
      "token": "your_discord_bot_token_here",
      "proxy": "http://127.0.0.1:7890",
      "allowBots": false,
      "groupPolicy": "open",
      "streaming": "off",
      "retry": {
        "attempts": 30,
        "minDelayMs": 1000,
        "maxDelayMs": 10000,
        "jitter": 0.5
      },
      "replyToMode": "first",
      "guilds": {
        "1479108494622851196": {
          "requireMention": false,
          "channels": {
            "*": {
              "allow": true
            }
          }
        }
      },
      "threadBindings": {
        "enabled": true
      },
      "inboundWorker": {
        "runTimeoutMs": 1800000
      }
    },
    "whatsapp": {
      "enabled": false,
      "dmPolicy": "allowlist",
      "allowFrom": ["+15551234567"],
      "groupPolicy": "allowlist",
      "debounceMs": 0,
      "mediaMaxMb": 50
    }
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `discord.enabled` | boolean | 是否启用Discord渠道 |
| `discord.token` | string | Discord Bot token（敏感信息，模版中应剔除） |
| `discord.proxy` | string | 代理地址 |
| `discord.retry` | object | 重连配置 |
| `discord.guilds` | object | 服务器配置 |
| `whatsapp.enabled` | boolean | 是否启用WhatsApp渠道 |
| `whatsapp.dmPolicy` | string | 私信策略：allowlist、blocklist、all |
| `whatsapp.allowFrom` | array | 允许的发件人列表 |
| `whatsapp.groupPolicy` | string | 群组策略：allowlist、blocklist、all |

### 13. 网关配置（gateway）

```json
{
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "loopback",
    "auth": {
      "mode": "token",
      "token": "your_gateway_token_here"
    },
    "tailscale": {
      "mode": "off",
      "resetOnExit": false
    },
    "nodes": {
      "denyCommands": [
        "camera.snap",
        "camera.clip",
        "screen.record",
        "contacts.add",
        "calendar.add",
        "reminders.add",
        "sms.send"
      ]
    }
  }
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|--------|----------|------|
| `port` | number | 18789 | 网关端口 |
| `mode` | string | "local" | 网关模式：local、remote |
| `bind` | string | "loopback" | 绑定地址：loopback、all |
| `auth.mode` | string | "token" | 认证模式：token、none |
| `auth.token` | string | - | 认证token（敏感信息，模版中应剔除） |
| `tailscale.mode` | string | "off" | Tailscale模式：off、on |
| `nodes.denyCommands` | array | - | 拒绝的命令列表 |

### 14. 记忆配置（memory）

```json
{
  "memory": {
    "citations": "off"
  }
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|--------|----------|------|
| `citations` | string | "off" | 引用模式：off、on |

### 15. 技能配置（skills）

```json
{
  "skills": {
    "allowBundled": [],
    "load": {
      "watch": true
    },
    "install": {
      "nodeManager": "npm"
    },
    "entries": {
      "weather": {
        "enabled": true
      },
      "coding-agent": {
        "enabled": true
      },
      "model-usage": {
        "enabled": true
      },
      "exa-web-search-free": {
        "enabled": true
      },
      "summarize": {
        "enabled": true
      }
    }
  }
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|--------|----------|------|
| `allowBundled` | array | - | 允许的内置技能 |
| `load.watch` | boolean | true | 是否监听文件变化 |
| `install.nodeManager` | string | "npm" | 包管理器：npm、yarn等 |
| `entries` | object | - | 技能配置列表 |
| `entries.{skill-name}.enabled` | boolean | - | 是否启用技能 |

## 敏感信息处理

在配置模版中，以下字段应剔除或使用占位符：

### 需要剔除的敏感字段
- `models.providers.{name}.apiKey` - API密钥
- `channels.discord.token` - Discord Bot token
- `gateway.auth.token` - 网关认证token
- 其他包含密码、密钥、token的字段

### 占位符示例
```json
{
  "models": {
    "providers": {
      "volcengine": {
        "apiKey": "your_api_key_here"
      }
    }
  },
  "channels": {
    "discord": {
      "token": "your_discord_bot_token_here"
    }
  },
  "gateway": {
    "auth": {
      "token": "your_gateway_token_here"
    }
  }
}
```

## 导入配置

### 通过Web界面导入

1. 登录系统
2. 进入"配置管理"页面
3. 点击"导入配置"按钮
4. 选择JSON配置文件
5. 系统会自动验证并导入

### 通过API导入

```bash
POST http://localhost:3000/api/user-configs/import
Content-Type: application/json
Authorization: Bearer your_token

{
  "meta": { ... },
  "logging": { ... },
  ...
}
```

## 配置验证规则

### 1. 结构验证
- 配置必须是有效的JSON对象
- 必填字段不能缺失

### 2. 类型验证
- 字段类型必须符合要求
- 枚举值必须在允许范围内

### 3. 路径验证
- 文件路径必须符合操作系统格式
- 路径必须存在或可创建

### 4. 端口验证
- 端口必须在有效范围内（1-65535）
- 端口不能被占用

### 5. 敏感信息验证
- 模版中不应包含真实的敏感信息
- 应使用占位符代替

## 配置示例

完整的OpenClaw配置示例请参考：[openclaw_config_example.json](./openclaw_config_example.json)

## 常见问题

### Q: 配置导入失败怎么办？
A: 检查JSON格式是否正确，确保所有必填字段都已填写，路径和端口是否有效。

### Q: 配置验证不通过怎么办？
A: 查看验证错误信息，根据提示修改配置。

### Q: 如何创建自定义配置？
A: 可以从模版开始，然后根据需要修改配置参数。

### Q: 配置文件大小有限制吗？
A: 建议配置文件不超过1MB，过大的配置可能影响性能。

### Q: 敏感信息如何处理？
A: 在配置模版中，敏感信息应使用占位符，用户导入后再填写真实值。

## 注意事项

1. **安全性**
   - 不要在配置中存储真实的敏感信息
   - 使用强密码和API密钥
   - 定期更新密钥和token

2. **性能**
   - 合理设置日志级别和文件大小
   - 根据系统资源调整上下文token限制
   - 启用缓存可以提高性能

3. **兼容性**
   - 确保配置符合OpenClaw版本要求
   - 为不同操作系统提供正确的路径格式
   - 测试配置在不同环境下的表现

4. **维护**
   - 定期更新配置版本
   - 记录配置变更历史
   - 备份重要配置