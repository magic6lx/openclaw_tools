@echo off
chcp 65001 > nul
echo ========================================
echo   OpenClaw Tools 启动脚本
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 检查Node.js...
node --version > nul 2>&1
if errorlevel 1 (
    echo   [错误] 未检测到Node.js，请先安装Node.js
    pause
    exit /b 1
)
echo   [OK] Node.js 已安装

echo.
echo [2/3] 启动后端服务 (端口 3002)...
start "OpenClaw-Server" cmd /k "cd /d %~dp0server && node src/index.js"

echo   等待后端启动...
timeout /t 2 /nobreak > nul

echo.
echo [3/3] 启动前端服务 (端口 3001)...
start "OpenClaw-Client" cmd /k "cd /d %~dp0client && npm run dev"

echo.
echo ========================================
echo   启动完成！
echo ========================================
echo   后端API: http://localhost:3002
echo   前端界面: http://localhost:3001
echo ========================================
echo.
echo 提示: 关闭此窗口不会停止服务
echo       如需停止服务，请关闭对应的命令行窗口
pause
