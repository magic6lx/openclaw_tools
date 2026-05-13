# OpenClaw 客户端用户操作手册

## 📖 目录

- [快速开始](#-快速开始)
- [Agent 介绍](#-agent-介绍)
- [如何切换 Agent](#-如何切换-agent)
- [常见问题](#-常见问题)

---

## 🚀 快速开始

### 1. 启动 Gateway

```bash
openclaw gateway start
```

### 2. 打开控制台

在浏览器中打开：http://127.0.0.1:18789/

### 3. 开始对话

在输入框中输入消息，按回车发送。

---

## 🤖 Agent 介绍

系统中有多个 Agent，它们各有专长：

| Agent | 名称 | 专长 |
|-------|------|------|
| `main` | 主助理 | 通用对话，处理日常问题 |
| `researcher` | 搜调研 | 搜索信息、抓取网页内容（使用 web_search） |
| `operator` | 控电脑 | 执行电脑操作命令 |
| `coder` | 写代码 | 编程、代码相关任务 |
| `docs` | 操作文档 | 文档处理（PDF、文本） |

---

## 🔄 如何切换 Agent

### 方法1：使用命令切换

在输入框中输入：

```
/agent researcher
```

切换到搜调研 Agent。

### 方法2：使用斜杠命令

```
/agents
```

查看所有可用的 Agent 列表。

---

## 🔍 常见问题

### Q: Agent 没有回复消息怎么办？

**检查步骤：**

1. 确认消息已发送（按回车）
2. 查看控制台日志：`openclaw logs --follow`
3. 确认 Gateway 正在运行：`openclaw gateway status`

### Q: 搜索结果返回乱码怎么办？

**原因：** 如果使用的是 `operator` Agent，它使用 curl 方式抓取网页，对于 JavaScript 渲染的网站（如 Bing、小红书）会返回乱码。

**解决方法：** 切换到 `researcher` Agent，它有专门的 `web_search` 工具，可以正确获取搜索结果。

```
/agent researcher
```

### Q: 如何查看当前 Gateway 状态？

```bash
openclaw gateway status
```

### Q: 如何重启 Gateway？

```bash
openclaw gateway restart
```

### Q: 群聊消息收不到怎么办？

**检查项：**

1. 群聊中是否 @ 了机器人
2. `groupPolicy` 是否设置为 `open`
3. 飞书开放平台的事件订阅是否配置正确（长连接模式）

---

## 💡 提示

- **搜索信息** → 使用 `/agent researcher`
- **执行命令** → 使用 `/agent operator`
- **编程任务** → 使用 `/agent coder`
- **日常对话** → 使用 `/agent main`

---

## 📞 获取帮助

- 查看日志：`openclaw logs --follow`
- 查看状态：`openclaw status`
- 官方文档：https://docs.openclaw.ai/
