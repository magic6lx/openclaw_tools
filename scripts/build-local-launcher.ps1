$ErrorActionPreference = "Stop"

$PROJECT_ROOT = $PSScriptRoot | Split-Path
$LAUNCHER_DIR = Join-Path $PROJECT_ROOT "openclaw-launcher"
$RELEASE_DIR = Join-Path $LAUNCHER_DIR "src-tauri\target\release"
$PUBLIC_DIR = Join-Path $PROJECT_ROOT "frontend\public"
$CONFIG_FILE = Join-Path $LAUNCHER_DIR "launcher.conf"

Write-Host "=== Local Launcher Build ===" -ForegroundColor Cyan

# 1. Build
Write-Host "`n[1/3] Building Tauri..." -ForegroundColor Yellow
Set-Location $LAUNCHER_DIR
npm run tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# 2. Copy config and launcher.js to exe dir
Write-Host "`n[2/3] Copying config..." -ForegroundColor Yellow
$TARGET_EXE = Join-Path $RELEASE_DIR "openclaw-launcher.exe"
$LAUNCHER_JS = Join-Path $LAUNCHER_DIR "launcher.js"
if (Test-Path $TARGET_EXE) {
    Copy-Item -Path $CONFIG_FILE -Destination $RELEASE_DIR -Force
    Write-Host "Config copied to: $RELEASE_DIR\launcher.conf" -ForegroundColor Green
    if (Test-Path $LAUNCHER_JS) {
        Copy-Item -Path $LAUNCHER_JS -Destination $RELEASE_DIR -Force
        Write-Host "Launcher.js copied to: $RELEASE_DIR\launcher.js" -ForegroundColor Green
    }
}

# 3. Copy to public (clean old versions first)
Write-Host "`n[3/3] Cleaning and copying to public..." -ForegroundColor Yellow
$EXE_NAME = "OpenClaw-Launcher-v1.0.3.exe"
$TARGET_PATH = Join-Path $PUBLIC_DIR $EXE_NAME
Get-ChildItem -Path $PUBLIC_DIR -Filter "OpenClaw-Launcher-*.exe" -File | Remove-Item -Force
Copy-Item -Path $TARGET_EXE -Destination $TARGET_PATH -Force
Write-Host "Copied to: $TARGET_PATH" -ForegroundColor Green

Write-Host "`n=== Done ===" -ForegroundColor Cyan