@echo off
chcp 65001 > nul 2>&1
echo ========================================
echo   OpenClaw Tools Starting Script
echo ========================================
echo.

cd /d "%~dp0"

echo [0/4] Cleaning up existing services...
echo   Stopping existing windows...
taskkill /F /FI "WINDOWTITLE eq OpenClaw-*" > nul 2>&1
echo   Killing processes on port 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    taskkill /F /PID %%a > nul 2>&1
)
echo   Killing processes on port 3002...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002 ^| findstr LISTENING') do (
    taskkill /F /PID %%a > nul 2>&1
)
echo   [OK] Cleanup done

echo.
echo [1/4] Checking Node.js...
node --version > nul 2>&1
if errorlevel 1 (
    echo   [ERROR] Node.js not found
    pause
    exit /b 1
)
echo   [OK] Node.js ready

echo.
echo [2/4] Starting backend (port 3002)...
start "OpenClaw-Server" cmd /k "cd /d %~dp0server && node src/index.js"

echo   Waiting for backend...
timeout /t 2 /nobreak > nul

echo.
echo [3/4] Starting frontend (port 3001)...
start "OpenClaw-Client" cmd /k "cd /d %~dp0client && npm run dev"

echo.
echo [4/4] Starting launcher (tray app)...
if exist "%~dp0launcher\dist_new\win-unpacked\OpenClaw Launcher.exe" (
    start "" "%~dp0launcher\dist_new\win-unpacked\OpenClaw Launcher.exe"
    echo   [OK] Launcher started
) else (
    echo   [SKIP] Launcher exe not found
)

echo.
echo ========================================
echo   Done!
echo ========================================
echo   Backend API: http://localhost:3002
echo   Frontend:    http://localhost:3001
echo ========================================
echo.
pause
