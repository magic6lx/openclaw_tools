@echo off
chcp 65001 >nul
echo ==========================================
echo   OpenClaw Tools 依赖安装脚本
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/3] 安装 Server 依赖...
cd server
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Server 依赖安装失败
    pause
    exit /b 1
)
echo [OK] Server 依赖安装完成
cd ..

echo.
echo [2/3] 安装 Client 依赖...
cd client
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Client 依赖安装失败
    pause
    exit /b 1
)
echo [OK] Client 依赖安装完成
cd ..

echo.
echo [3/3] 安装 Launcher 依赖...
cd launcher
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Launcher 依赖安装失败
    pause
    exit /b 1
)
echo [OK] Launcher 依赖安装完成
cd ..

echo.
echo ==========================================
echo   所有依赖安装完成！
echo ==========================================
echo.
echo 下一步：
echo   1. 初始化数据库: mysql -u root -p < server\scripts\init-db.sql
echo   2. 启动服务: start.bat
echo.
pause
