#!/bin/bash

# ===========================================
# OpenClaw 离线部署打包脚本
# 在本地执行，打包后上传到腾讯云服务器
# ===========================================

set -e

OUTPUT_FILE="openclaw_deploy.tar.gz"

echo "=========================================="
echo "  OpenClaw 离线部署打包"
echo "=========================================="
echo ""

# 1. 安装依赖
echo "[1/4] 安装项目依赖..."
cd frontend && npm install && npm run build && cd ..
cd backend && npm install --production && cd ..

# 2. 打包
echo "[2/4] 打包项目..."
tar -czvf "$OUTPUT_FILE" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='logs' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='dist' \
  --exclude='.vscode' \
  --exclude='.idea' \
  -C frontend build \
  -C backend . \
  -C backend/ecosystem.config.js \
  -C backend/.env.production \
  -C deploy . \
  -C database . \
  -C config .

# 3. 显示打包结果
echo ""
echo "[3/4] 打包完成！"
ls -lh "$OUTPUT_FILE"

# 4. 说明
echo ""
echo "[4/4] 使用说明："
echo "  1. 上传 $OUTPUT_FILE 到腾讯云服务器:"
echo "     scp $OUTPUT_FILE root@你的服务器IP:/tmp/"
echo ""
echo "  2. 在服务器上解压:"
echo "     cd /var/www"
echo "     tar -xzvf /tmp/$OUTPUT_FILE"
echo ""
echo "  3. 按 deploy/DEPLOY_GUIDE.md 进行部署"
echo ""

echo "=========================================="
