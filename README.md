# OpenClaw Tools

OpenClaw 的 SaaS 化管理平台，帮助小白用户快速安装和体验 AI 助手。

## 项目定位

OpenClaw 本身是一个强大的 AI Agent 框架，但安装配置门槛较高（需要命令行操作、手动配置 API Key 等）。本项目解决的核心问题是：

> **让不会敲命令的人，也能 3 分钟用上 AI 助手。**

通过 Launcher + Web 管理后台 + Token 代理，将 OpenClaw 的安装、配置、运营全部可视化，并提供邀请码机制让用户零门槛体验。
<img width="1813" height="860" alt="main - 副本" src="https://github.com/user-attachments/assets/3faa69fc-2640-4a3e-bd62-693fce142117" />

## 核心功能

### 服务端（server/）

- **邀请码系统** — 生成/管理邀请码，用户凭码激活获得 1 万 Token 体验额度
- **Token 代理** — 统一代理 AI API 请求，精确统计每次调用的 Token 消耗
- **多租户管理** — 每个用户独立配额，超额自动熔断
- **配置模板** — 预设配置模板，用户一键应用，无需手动编辑 JSON
- **数据看板** — 用量统计、Token 消耗趋势、用户管理
- **系统规则** — manifest / migration / system 三类规则，控制同步行为

### 客户端 Web（client/）

- **首页仪表盘** — Launcher / Gateway / OpenClaw / 服务端连接四维状态监控
- **安装及配置** — 一键检测版本、一键安装/升级 OpenClaw
- **关键配置** — 配置模板选择、Token 代理开关、私有模板保存/回滚
- **飞书消息通道** — 扫码快捷配置飞书机器人，或手动填写 App ID/Secret
- **日常运营** — 一键启动/停止/重启 Gateway，实时日志查看
- **诊断工具** — 排查连接问题

### Launcher（launcher/）

- 本地管理代理，运行在用户电脑上（端口 3003）
- 负责执行安装、配置读写、Gateway 启停等本地操作
- Web 后台通过 HTTP API 与 Launcher 通信

## 架构

```
用户电脑                              云服务器
┌─────────────────────┐              ┌──────────────────┐
│  飞书 ←→ OpenClaw    │              │  server (3002)    │
│           ↑          │              │  ├─ 邀请码管理     │
│       Gateway(18789) │              │  ├─ Token 代理     │
│           ↑          │              │  ├─ 配置模板       │
│       Launcher(3003) │◄── HTTP ───►│  ├─ 用量统计       │
│           ↑          │              │  └─ 数据看板       │
│       Web 管理后台    │              │                    │
│       (localhost)    │              │  client (3001)     │
└─────────────────────┘              └──────────────────┘
```

## 项目结构

```
openclaw_tools/
├── server/                # Node.js 后端
│   └── src/
│       ├── index.js           # 入口，启动服务
│       ├── db.js              # MySQL 数据库连接
│       ├── routes/api.js      # API 路由（代理、邀请码、模板等）
│       ├── services/logService.js  # 日志服务
│       ├── config/configSchema.js  # 配置校验
│       └── middleware/auth.js      # 邀请码认证
│
├── client/                # React 前端
│   └── src/
│       ├── App.jsx
│       ├── pages/
│       │   ├── Home.jsx           # 首页仪表盘
│       │   ├── Install.jsx        # 安装及配置
│       │   ├── Config.jsx         # 关键配置
│       │   ├── FeishuChannel.jsx  # 飞书消息通道
│       │   ├── Operations.jsx     # 日常运营
│       │   ├── Login.jsx          # 邀请码登录
│       │   ├── LauncherDiagnostics.jsx  # 诊断工具
│       │   └── admin/             # 管理员页面
│       │       ├── Invitations.jsx    # 邀请码管理
│       │       ├── Statistics.jsx     # 用量统计
│       │       ├── SystemConfig.jsx   # 系统规则配置
│       │       └── Templates.jsx      # 配置模板管理
│       ├── components/
│       │   ├── FeishuSetup.jsx     # 飞书配置组件
│       │   ├── ConfigForm.jsx      # 配置表单
│       │   └── QuickSettings.jsx   # 快捷设置
│       └── utils/launcher.js      # Launcher API 封装
│
├── launcher/              # 客户端本地代理
│   └── src/
│       └── index.js           # Launcher 主程序（Express，端口 3003）
│
├── docs/                  # 文档
│   ├── openclaw.json          # OpenClaw 配置参考
│   ├── USER_GUIDE.md          # 用户操作手册
│   └── SALES_MATERIAL.md      # 产品介绍文案
│
├── reference/             # OpenClaw 官方文档参考
│   └── openclaw/
│       ├── docs/              # 英文文档
│       └── mdocs/             # 中文设计说明
│
└── nginx.conf             # Nginx 配置
```

## 部署

```bash
# 服务器上
cd /opt/openclaw_tool_server
./deploy.sh
```

## 端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 3001 | Nginx 托管的生产前端 |
| 后端 | 3002 | Node.js API 服务 |
| Launcher | 3003 | 用户本地管理代理 |
| Gateway | 18789 | OpenClaw AI 服务 |

## 优势

- ✅ **零门槛体验** — 邀请码 + Token 代理，用户无需申请 API Key 即可体验
- ✅ **可视化操作** — 安装、配置、运营全流程 Web 化，不用敲命令
- ✅ **配置模板** — 预设模板一键应用，降低配置出错率
- ✅ **Token 级计费** — 精确统计每次 API 调用消耗
- ✅ **多租户隔离** — 每个用户独立配额，互不干扰
- ✅ **飞书扫码配置** — 简化飞书机器人接入流程

## 劣势 / 已知限制

- ⚠️ **依赖 OpenClaw** — 本项目是 OpenClaw 的上层管理工具，不独立提供 AI 能力
- ⚠️ **仅支持 Windows** — Launcher 目前仅支持 Windows x64
- ⚠️ **仅支持飞书** — 消息通道目前仅对接飞书，其他平台待扩展
- ⚠️ **Token 代理仅支持部分模型** — 代理转发兼容 OpenAI / Volcengine / Doubao 协议
- ⚠️ **本地部署依赖** — 用户需在本地运行 Launcher，无法纯云端管理
