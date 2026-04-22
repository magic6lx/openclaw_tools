# OpenClaw 新架构

## 项目结构

```
openclaw-v2/
├── server/                        # 服务器端 (Node.js)
│   ├── package.json
│   ├── ecosystem.config.js        # PM2 配置
│   ├── src/
│   │   ├── index.js              # Express 入口
│   │   ├── routes/api.js         # API 路由
│   │   └── services/logService.js # 日志服务
│   └── public/                    # React 前端构建输出
│
├── client/                        # React 前端源码
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── pages/
│           ├── Dashboard.jsx
│           └── Clients.jsx
│
├── launcher/                      # 本地客户端代理
│   ├── package.json
│   ├── src/index.js              # 核心逻辑
│   └── electron/main.js          # Electron 托盘
│
├── .env.example                   # 环境变量示例
├── deploy.sh                      # 部署脚本
├── nginx.conf                     # Nginx 配置
└── PROJECT.md                     # 项目说明
```

## 端口配置

| 服务 | 端口 | 说明 |
|------|------|------|
| Nginx/前端 | 3001 | 静态文件 + API 反代 |
| Backend API | 3002 | Express |

## 核心 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/logs | 客户端上传日志 |
| GET | /api/logs | 获取日志列表 |
| GET | /api/launcher/version | 获取 Launcher 版本 |

## 部署步骤

```bash
# 1. 上传项目到服务器
scp -r openclaw-v2 root@服务器:/opt/

# 2. SSH 登录服务器
ssh root@服务器

# 3. 运行部署脚本
cd /opt/openclaw_v2
chmod +x deploy.sh
./deploy.sh

# 4. 配置 Nginx
cp nginx.conf /etc/nginx/sites-available/openclaw
nginx -t && systemctl reload nginx
```

## Launcher 工作流程

```
客户端电脑                      服务器
   │                            │
   ▼                            │
┌────────────────┐              │
│   Launcher     │──POST /api/logs──►  Server
│  (系统托盘)     │              │
└────────────────┘              │
```

## 开发命令

```bash
# 后端
cd server && npm run dev

# 前端
cd client && npm run dev
```
