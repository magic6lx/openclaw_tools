#!/bin/bash

set -e

echo "===== OpenClaw 部署脚本 ====="

DEPLOY_DIR="/opt/openclaw_tool_server"
cd "$DEPLOY_DIR"

echo "[1/4] 安装后端依赖..."
cd server && npm install && cd ..

echo "[2/4] 构建前端..."
cd client && npm install && npm run build && cd ..

echo "[3/4] 配置 PM2..."
cd server
pm2 delete openclaw-server 2>/dev/null || true
pm2 start ecosystem.config.js --env production

echo "[4/4] 完成!"
echo "后端运行在端口 3002"
echo "前端运行在端口 3001 (需要配置 Nginx)"
