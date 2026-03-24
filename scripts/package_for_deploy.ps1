# OpenClaw Offline Deploy Script (Windows PowerShell)
# Run: .\scripts\package_for_deploy.ps1

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  OpenClaw Offline Deploy Package" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$OUTPUT_FILE = "openclaw_deploy.zip"

# 1. Build frontend
Write-Host "[1/5] Building frontend..." -ForegroundColor Yellow
Set-Location frontend
npm install
$env:VITE_API_BASE_URL="/api"
npm run build
Set-Location ..

# 2. Install backend dependencies
Write-Host "[2/5] Installing backend dependencies..." -ForegroundColor Yellow
Set-Location backend
npm install --production
Set-Location ..

# 3. Prepare files
Write-Host "[3/5] Preparing files..." -ForegroundColor Yellow
$TEMP_DIR = ".\deploy_temp"
if (Test-Path $TEMP_DIR) { Remove-Item $TEMP_DIR -Recurse -Force }
New-Item -ItemType Directory -Path $TEMP_DIR | Out-Null

# Copy frontend build
Copy-Item -Path ".\frontend\dist" -Destination "$TEMP_DIR\frontend\dist" -Recurse

# Copy backend
Copy-Item -Path ".\backend\src" -Destination "$TEMP_DIR\backend\src" -Recurse
Copy-Item -Path ".\backend\package.json" -Destination "$TEMP_DIR\backend\"
Copy-Item -Path ".\backend\ecosystem.config.js" -Destination "$TEMP_DIR\backend\"
Copy-Item -Path ".\backend\.env.production" -Destination "$TEMP_DIR\backend\"

# Copy deploy config
Copy-Item -Path ".\deploy" -Destination "$TEMP_DIR\deploy" -Recurse

# Copy database scripts
Copy-Item -Path ".\database" -Destination "$TEMP_DIR\database" -Recurse

# Copy config
New-Item -ItemType Directory -Path "$TEMP_DIR\config" -Force | Out-Null
Copy-Item -Path ".\config\.env.example" -Destination "$TEMP_DIR\config\"

# Copy .env.example as template for .env (user must fill in real password)
New-Item -ItemType Directory -Path "$TEMP_DIR\backend" -Force | Out-Null
Copy-Item -Path ".\config\.env.example" -Destination "$TEMP_DIR\backend\.env"

# Copy LICENSE
Copy-Item -Path ".\LICENSE" -Destination "$TEMP_DIR\"

# 4. Package
Write-Host "[4/5] Packaging..." -ForegroundColor Yellow
if (Test-Path ".\$OUTPUT_FILE") { Remove-Item ".\$OUTPUT_FILE" -Force }
Compress-Archive -Path "$TEMP_DIR\*" -DestinationPath ".\$OUTPUT_FILE" -Force

# 5. Cleanup
Write-Host "[5/5] Cleanup..." -ForegroundColor Yellow
Remove-Item $TEMP_DIR -Recurse -Force

# Show result
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Package Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Output: $OUTPUT_FILE" -ForegroundColor White
Get-Item ".\$OUTPUT_FILE" | Select-Object Name, @{N="Size(MB)";E={"$([math]::Round($_.Length/1MB, 2))"}}
Write-Host ""

# Instructions
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Upload to server:" -ForegroundColor White
Write-Host "     scp $OUTPUT_FILE root@your_server_ip:/tmp/" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. On server, extract:" -ForegroundColor White
Write-Host "     cd /opt/openclaw_tool_server" -ForegroundColor Gray
Write-Host "     unzip /tmp/$OUTPUT_FILE" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Follow deploy/DEPLOY_GUIDE.md for deployment" -ForegroundColor White
Write-Host ""
