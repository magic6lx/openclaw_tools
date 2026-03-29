$ErrorActionPreference = "Stop"

$PROJECT_ROOT = "D:\Tu工作同步\My工作同步\openclaw_tools"
$LAUNCHER_DIR = "$PROJECT_ROOT\openclaw-launcher"
$RELEASE_DIR = "$LAUNCHER_DIR\src-tauri\target\release"
$PUBLIC_DIR = "$PROJECT_ROOT\frontend\public"
$CONFIG_FILE = "$LAUNCHER_DIR\launcher.conf"

Write-Host "=== 本地开发 Launcher 构建脚本 ===" -ForegroundColor Cyan

# 1. 编译
Write-Host "`n[1/3] 编译 Tauri..." -ForegroundColor Yellow
Set-Location $LAUNCHER_DIR
npm run tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Host "编译失败!" -ForegroundColor Red
    exit 1
}

# 2. 复制配置文件到 exe 同级目录
Write-Host "`n[2/3] 复制配置文件到 exe 同级目录..." -ForegroundColor Yellow
$TARGET_EXE = "$RELEASE_DIR\openclaw-launcher.exe"
if (Test-Path $TARGET_EXE) {
    Copy-Item -Path $CONFIG_FILE -Destination $RELEASE_DIR -Force
    Write-Host "配置文件已复制到: $RELEASE_DIR\launcher.conf" -ForegroundColor Green
} else {
    Write-Host "警告: 未找到 exe 文件" -ForegroundColor Red
}

# 3. 复制到 public 目录
Write-Host "`n[3/3] 复制到 public 目录..." -ForegroundColor Yellow
$EXE_NAME = "OpenClaw-Launcher-v1.0.2.exe"
Copy-Item -Path "$RELEASE_DIR\openclaw-launcher.exe" -Destination "$PUBLIC_DIR\$EXE_NAME" -Force
Write-Host "已复制到: $PUBLIC_DIR\$EXE_NAME" -ForegroundColor Green

Write-Host "`n=== 完成 ===" -ForegroundColor Cyan
Write-Host "本地开发配置: $CONFIG_FILE" -ForegroundColor White
Write-Host "服务地址: http://localhost:3001" -ForegroundColor White