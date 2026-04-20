# OpenClaw Tools 开发环境启动脚本
# 启动 Tauri Launcher、前端和后端开发服务器

$ErrorActionPreference = "SilentlyContinue"
$PROJECT_ROOT = Split-Path $PSScriptRoot -Parent

Write-Host "=== Start OpenClaw Tools Dev ===" -ForegroundColor Cyan

# 关闭旧的 Tauri Launcher
Write-Host "`n[0/3] Stopping old Launcher..." -ForegroundColor Yellow
Get-Process -Name "openclaw-launcher" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  Stopping PID $($_.Id)" -ForegroundColor Gray
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1

# 启动 Tauri Launcher
Write-Host "`n[1/3] Starting Tauri Launcher..." -ForegroundColor Yellow
$launcherPath = Join-Path $PROJECT_ROOT "openclaw-launcher\src-tauri\target\release\openclaw-launcher.exe"
if (Test-Path $launcherPath) {
    Start-Process -FilePath $launcherPath
    Write-Host "  Launcher started" -ForegroundColor Green
} else {
    Write-Host "  Launcher not found at: $launcherPath" -ForegroundColor Red
    Write-Host "  Please build first: cd openclaw-launcher; npm run build" -ForegroundColor Yellow
}

Start-Sleep -Seconds 2

# 启动后端服务
Write-Host "`n[2/3] Starting Backend Server..." -ForegroundColor Yellow
$backendPath = Join-Path $PROJECT_ROOT "backend"
if (Test-Path (Join-Path $backendPath "package.json")) {
    Start-Process -FilePath "cmd" -ArgumentList "/c npm run start" -WorkingDirectory $backendPath -NoNewWindow
    Write-Host "  Backend starting on http://127.0.0.1:3002" -ForegroundColor Green
} else {
    Write-Host "  Backend not found" -ForegroundColor Red
}

# 启动前端开发服务器
Write-Host "`n[3/3] Starting Frontend Dev Server..." -ForegroundColor Yellow
$frontendPath = Join-Path $PROJECT_ROOT "frontend"
if (Test-Path (Join-Path $frontendPath "package.json")) {
    Start-Process -FilePath "cmd" -ArgumentList "/c npm run dev" -WorkingDirectory $frontendPath -NoNewWindow
    Write-Host "  Frontend starting on http://localhost:3001" -ForegroundColor Green
} else {
    Write-Host "  Frontend not found" -ForegroundColor Red
}

Write-Host "`n=== Started ===" -ForegroundColor Green
Write-Host "Backend API: http://127.0.0.1:3002" -ForegroundColor White
Write-Host "Tauri Launcher: http://127.0.0.1:18790 (API)" -ForegroundColor White
Write-Host "Frontend: http://localhost:3001" -ForegroundColor White
Write-Host "Gateway Console: http://127.0.0.1:18789" -ForegroundColor White
Write-Host "`nPress Ctrl+C to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
