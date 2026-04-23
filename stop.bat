@echo off
chcp 65001 > nul
echo ========================================
echo   OpenClaw Tools 停止脚本
echo ========================================
echo.

echo 正在停止所有服务...

echo.
echo [1/2] 停止前端服务...
taskkill /F /FI "WINDOWTITLE eq OpenClaw-Client*" > nul 2>&1
if errorlevel 1 (
    echo   未找到运行中的前端服务
) else (
    echo   [OK] 前端服务已停止
)

echo.
echo [2/2] 停止后端服务...
taskkill /F /FI "WINDOWTITLE eq OpenClaw-Server*" > nul 2>&1
if errorlevel 1 (
    echo   未找到运行中的后端服务
) else (
    echo   [OK] 后端服务已停止
)

echo.
echo ========================================
echo   所有服务已停止
echo ========================================
pause
