#!/bin/bash

echo "========================================"
echo "  OpenClaw Tools 停止脚本"
echo "========================================"
echo ""

echo "正在停止所有服务..."

echo ""
echo "[1/2] 停止前端服务..."
CLIENT_PIDS=$(ps aux | grep "npm run dev" | grep -v grep | awk '{print $2}')
if [ -z "$CLIENT_PIDS" ]; then
    echo "  未找到运行中的前端服务"
else
    kill $CLIENT_PIDS 2>/dev/null
    echo "  [OK] 前端服务已停止"
fi

echo ""
echo "[2/2] 停止后端服务..."
SERVER_PIDS=$(ps aux | grep "node src/index.js" | grep -v grep | awk '{print $2}')
if [ -z "$SERVER_PIDS" ]; then
    echo "  未找到运行中的后端服务"
else
    kill $SERVER_PIDS 2>/dev/null
    echo "  [OK] 后端服务已停止"
fi

echo ""
echo "========================================"
echo "  所有服务已停止"
echo "========================================"
