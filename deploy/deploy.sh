#!/bin/bash

# ===========================================
# OpenClaw 一键部署脚本 (腾讯云Linux)
# ===========================================

set -e

echo "=========================================="
echo "  OpenClaw 智能配置系统 - 一键部署"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 sudo 运行此脚本${NC}"
    exit 1
fi

# 1. 安装Node.js (如果未安装)
echo -e "${YELLOW}[1/6] 检查Node.js环境...${NC}"
if ! command -v node &> /dev/null; then
    echo "安装Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
else
    echo -e "${GREEN}Node.js已安装: $(node -v)${NC}"
fi

# 2. 安装Nginx
echo -e "${YELLOW}[2/6] 检查Nginx环境...${NC}"
if ! command -v nginx &> /dev/null; then
    echo "安装Nginx..."
    apt-get update
    apt-get install -y nginx
else
    echo -e "${GREEN}Nginx已安装${NC}"
fi

# 3. 安装PM2
echo -e "${YELLOW}[3/6] 安装PM2进程管理器...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    echo -e "${GREEN}PM2安装完成${NC}"
else
    echo -e "${GREEN}PM2已安装${NC}"
fi

# 4. 创建部署目录
echo -e "${YELLOW}[4/6] 创建部署目录...${NC}"
DEPLOY_DIR="/var/www/openclaw"
mkdir -p $DEPLOY_DIR
mkdir -p $DEPLOY_DIR/backend/logs

# 5. 上传代码 (需要先手动上传项目到服务器)
# 这里假设你已经通过scp/git等方式上传了代码
echo -e "${YELLOW}[5/6] 安装依赖...${NC}"

# 安装后端依赖
cd $DEPLOY_DIR/backend
npm install --production

# 构建前端
cd $DEPLOY_DIR/frontend
npm install
npm run build

# 6. 配置Nginx
echo -e "${YELLOW}[6/6] 配置Nginx...${NC}"
cp $DEPLOY_DIR/deploy/nginx.conf /etc/nginx/sites-available/openclaw
ln -sf /etc/nginx/sites-available/openclaw /etc/nginx/sites-enabled/

# 测试Nginx配置
nginx -t

# 重载Nginx
systemctl reload nginx

# 启动后端服务
cd $DEPLOY_DIR/backend
pm2 delete openclaw-backend 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

# 设置开机自启
pm2 startup

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "请访问: http://your_server_ip"
echo ""
echo "常用命令:"
echo "  查看日志: pm2 logs openclaw-backend"
echo "  重启服务: pm2 restart openclaw-backend"
echo "  查看状态: pm2 status"
echo ""
