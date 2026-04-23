@echo off
chcp 65001 >nul
echo ==========================================
echo   OpenClaw Tools 数据库初始化脚本
echo ==========================================
echo.

cd /d "%~dp0"

echo 请确保 MySQL 服务已启动
echo.

set /p DB_HOST="请输入数据库地址 (默认: 134.175.18.139): "
if "%DB_HOST%"=="" set DB_HOST=134.175.18.139

set /p DB_PORT="请输入数据库端口 (默认: 3306): "
if "%DB_PORT%"=="" set DB_PORT=3306

set /p DB_USER="请输入数据库用户名 (默认: root): "
if "%DB_USER%"=="" set DB_USER=root

set /p DB_PASS="请输入数据库密码 (默认: root@126.com): "
if "%DB_PASS%"=="" set DB_PASS=root@126.com

echo.
echo 正在初始化数据库...
echo.

mysql -h %DB_HOST% -P %DB_PORT% -u %DB_USER% -p%DB_PASS% < server\scripts\init-db.sql

if %errorlevel% equ 0 (
    echo.
    echo ==========================================
    echo   数据库初始化成功！
    echo ==========================================
    echo.
    echo 默认邀请码：
    echo   ADMIN12345678  (管理员, 10设备)
    echo   USER98765432    (普通用户, 3设备)
    echo   TEST11111111   (已禁用)
) else (
    echo.
    echo [ERROR] 数据库初始化失败，请检查配置
)

pause
