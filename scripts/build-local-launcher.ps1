$ErrorActionPreference = "Stop"

$PROJECT_ROOT = $PSScriptRoot | Split-Path
$LAUNCHER_DIR = Join-Path $PROJECT_ROOT "openclaw-launcher"
$RELEASE_DIR = Join-Path $LAUNCHER_DIR "src-tauri\target\release"
$PUBLIC_DIR = Join-Path $PROJECT_ROOT "frontend\public"
$CONFIG_FILE = Join-Path $LAUNCHER_DIR "launcher.conf"
$SRC_UI_DIR = Join-Path $LAUNCHER_DIR "src-ui"

Write-Host "=== Local Launcher Build ===" -ForegroundColor Cyan

# 1. Build src-ui (tray UI)
Write-Host "`n[1/3] Building src-ui (tray)..." -ForegroundColor Yellow
Set-Location $SRC_UI_DIR
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "src-ui build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "src-ui built: src-ui/dist" -ForegroundColor Green

# 2. Build Tauri
Write-Host "`n[2/3] Building Tauri..." -ForegroundColor Yellow
Set-Location $LAUNCHER_DIR
npm run tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# 3. Copy config and launcher.js to exe dir
Write-Host "`n[3/3] Copying config..." -ForegroundColor Yellow
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

# Copy CHANGELOG.md to release dir
$CHANGELOG = Join-Path $LAUNCHER_DIR "CHANGELOG.md"
if (Test-Path $CHANGELOG) {
    Copy-Item -Path $CHANGELOG -Destination $RELEASE_DIR -Force
    Write-Host "CHANGELOG.md copied to: $RELEASE_DIR\CHANGELOG.md" -ForegroundColor Green
}

# Copy to public (clean old versions first)
$EXE_NAME = "OpenClaw-Launcher-v1.0.3.exe"
$TARGET_PATH = Join-Path $PUBLIC_DIR $EXE_NAME
Get-ChildItem -Path $PUBLIC_DIR -Filter "OpenClaw-Launcher-*.exe" -File | Remove-Item -Force
Copy-Item -Path $TARGET_EXE -Destination $TARGET_PATH -Force
Write-Host "Copied to: $TARGET_PATH" -ForegroundColor Green

Write-Host "`n=== Done ===" -ForegroundColor Cyan