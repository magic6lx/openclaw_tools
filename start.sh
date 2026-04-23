#!/bin/bash

echo "========================================"
echo "  OpenClaw Tools 启动脚本"
echo "========================================"
echo ""

cd "$(dirname "$0")"

echo "[1/3] 检查Node.js..."
if ! command -v node &> /dev/null; then
    echo "  [错误] 未检测到Node.js，请先安装Node.js"
    exit 1
fi
echo "  [OK] Node.js 已安装"

echo ""
echo "[2/3] 启动后端服务 (端口 3002)..."
cd server && nohup node src/index.js > server.log 2>&1 &
SERVER_PID=$!
echo "  后端 PID: $SERVER_PID"

echo ""
echo "[3/3] 启动前端服务 (端口 3001)..."
cd ../client && nohup npm run dev > client.log 2>&1 &
CLIENT_PID=$!
echo "  前端 PID: $CLIENT_PID"

echo ""
echo "========================================"
echo "  启动完成！"
echo "========================================"
echo "  后端API: http://localhost:3002"
echo "  前端界面: http://localhost:3001"
echo "========================================"
echo ""
echo "提示: 使用 ./stop.sh 停止服务"
