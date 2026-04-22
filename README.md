# OpenClaw V2

极简架构的 OpenClaw 管理平台。

## 项目结构

```
openclaw-v2/
├── server/           # Node.js 后端 (端口 3002)
│   └── src/
│       ├── index.js
│       ├── routes/api.js
│       └── services/logService.js
│
├── client/          # React 前端 (端口 5173 开发)
│   └── src/
│       ├── App.jsx
│       └── pages/
│           ├── Dashboard.jsx
│           └── Clients.jsx
│
├── launcher/        # 客户端代理
│   ├── src/index.js
│   └── electron/main.js
│
└── nginx.conf       # Nginx 配置
```

## 部署

```bash
# 服务器上
cd /opt/openclaw_tool_server
./deploy.sh
```

## 端口

- 前端: 3001
- 后端: 3002
