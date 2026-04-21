$ErrorActionPreference = "Stop"

$PROJECT_ROOT = $PSScriptRoot | Split-Path
$LAUNCHER_DIR = Join-Path $PROJECT_ROOT "openclaw-launcher"
$RELEASE_DIR = Join-Path $LAUNCHER_DIR "src-tauri\target\release"
$PUBLIC_DIR = Join-Path $PROJECT_ROOT "frontend\public"
$CONFIG_FILE = Join-Path $LAUNCHER_DIR "launcher.conf"

Write-Host "=== Local Launcher Build ===" -ForegroundColor Cyan

# Validate config consistency
Write-Host "`n[0/4] Validating config consistency..." -ForegroundColor Yellow
$VITE_CONFIG = Join-Path $PROJECT_ROOT "frontend\vite.config.js"
$TAURI_CONFIG = Join-Path $LAUNCHER_DIR "src-tauri\tauri.conf.json"
if (Test-Path $VITE_CONFIG) {
    $viteContent = Get-Content $VITE_CONFIG -Raw
    $tauriContent = Get-Content $TAURI_CONFIG -Raw
    if ($viteContent -match 'outDir:[^''"]*[''"]([^''"]+)[''"]' -and $tauriContent -match '"frontendDist"\s*:\s*"[^"]*/([^"]+)"') {
        $viteDir = $Matches[1]
        $tauriDir = $Matches[1]
        if ($viteDir -ne $tauriDir) {
            Write-Host "ERROR: vite.config.js outDir ('$viteDir') != tauri.conf.json frontendDist ('$tauriDir')" -ForegroundColor Red
            exit 1
        } else {
            Write-Host "Config validated: both use '$viteDir'" -ForegroundColor Green
        }
    }
}

# 1. Build frontend first
Write-Host "`n[1/4] Building frontend..." -ForegroundColor Yellow
Set-Location (Join-Path $PROJECT_ROOT "frontend")
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    exit 1
}

# Copy frontend dist to launcher dist (Tauri reads from openclaw-launcher/dist)
Write-Host "`n[1b/5] Syncing frontend dist to launcher dist..." -ForegroundColor Yellow
$FRONTEND_DIST = Join-Path $PROJECT_ROOT "frontend\dist"
$LAUNCHER_DIST = Join-Path $LAUNCHER_DIR "dist"
if (Test-Path $LAUNCHER_DIST) {
    Remove-Item -Path $LAUNCHER_DIST -Recurse -Force
}
Copy-Item -Path $FRONTEND_DIST -Destination $LAUNCHER_DIST -Recurse -Force
Write-Host "Synced: frontend\dist -> openclaw-launcher\dist" -ForegroundColor Green

# 2. Build Tauri
Write-Host "`n[2/4] Building Tauri..." -ForegroundColor Yellow
Set-Location $LAUNCHER_DIR
npm run tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# 3. Copy config and launcher.js to exe dir
Write-Host "`n[3/4] Copying config..." -ForegroundColor Yellow
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

# 4. Copy to public (clean old versions first)
Write-Host "`n[4/4] Cleaning and copying to public..." -ForegroundColor Yellow
$EXE_NAME = "OpenClaw-Launcher-v1.0.3.exe"
$TARGET_PATH = Join-Path $PUBLIC_DIR $EXE_NAME
Get-ChildItem -Path $PUBLIC_DIR -Filter "OpenClaw-Launcher-*.exe" -File | Remove-Item -Force
Copy-Item -Path $TARGET_EXE -Destination $TARGET_PATH -Force
Write-Host "Copied to: $TARGET_PATH" -ForegroundColor Green

Write-Host "`n=== Done ===" -ForegroundColor Cyan