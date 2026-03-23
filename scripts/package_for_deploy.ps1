# OpenClaw 离线部署打包脚本 (Windows PowerShell)
# 运行方式: 右键 -> "使用PowerShell运行" 或 .\scripts\package_for_deploy.ps1

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  OpenClaw 离线部署打包" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$OUTPUT_FILE = "openclaw_deploy.zip"

# 1. 构建前端
Write-Host "[1/5] 构建前端..." -ForegroundColor Yellow
Set-Location frontend
npm install
npm run build
Set-Location ..

# 2. 安装后端依赖
Write-Host "[2/5] 安装后端依赖..." -ForegroundColor Yellow
Set-Location backend
npm install --production
Set-Location ..

# 3. 创建临时目录结构
Write-Host "[3/5] 准备打包文件..." -ForegroundColor Yellow
$TEMP_DIR = ".\deploy_temp"
if (Test-Path $TEMP_DIR) { Remove-Item $TEMP_DIR -Recurse -Force }
New-Item -ItemType Directory -Path $TEMP_DIR | Out-Null

# 复制前端构建
Copy-Item -Path ".\frontend\dist" -Destination "$TEMP_DIR\frontend\dist" -Recurse

# 复制后端
Copy-Item -Path ".\backend\src" -Destination "$TEMP_DIR\backend\src" -Recurse
Copy-Item -Path ".\backend\package.json" -Destination "$TEMP_DIR\backend\"
Copy-Item -Path ".\backend\ecosystem.config.js" -Destination "$TEMP_DIR\backend\"
Copy-Item -Path ".\backend\.env.production" -Destination "$TEMP_DIR\backend\"

# 复制部署配置
Copy-Item -Path ".\deploy" -Destination "$TEMP_DIR\deploy" -Recurse

# 复制数据库脚本
Copy-Item -Path ".\database" -Destination "$TEMP_DIR\database" -Recurse

# 复制配置文件
Copy-Item -Path ".\config\.env.example" -Destination "$TEMP_DIR\config\"

# 复制LICENSE
Copy-Item -Path ".\LICENSE" -Destination "$TEMP_DIR\"

# 复制package.json (根目录)
Copy-Item -Path ".\package.json" -Destination "$TEMP_DIR\"

# 4. 打包
Write-Host "[4/5] 打包项目..." -ForegroundColor Yellow
Compress-Archive -Path "$TEMP_DIR\*" -DestinationPath ".\$OUTPUT_FILE" -Force

# 5. 清理
Write-Host "[5/5] 清理临时文件..." -ForegroundColor Yellow
Remove-Item $TEMP_DIR -Recurse -Force

# 显示结果
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  打包完成！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "输出文件: $OUTPUT_FILE" -ForegroundColor White
Get-Item ".\$OUTPUT_FILE" | Select-Object Name, @{N="大小";E={"$([math]::Round($_.Length/1MB, 2)) MB"}}
Write-Host ""

# 使用说明
Write-Host "下一步操作：" -ForegroundColor Cyan
Write-Host "  1. 上传 $OUTPUT_FILE 到腾讯云服务器:" -ForegroundColor White
Write-Host '     scp $OUTPUT_FILE root@你的服务器IP:/tmp/' -ForegroundColor Gray
Write-Host ""
Write-Host "  2. 在服务器上解压:" -ForegroundColor White
Write-Host '     cd /var/www' -ForegroundColor Gray
Write-Host '     unzip $OUTPUT_FILE' -ForegroundColor Gray
Write-Host '     或 tar -xzvf $OUTPUT_FILE (如果是tar.gz格式)' -ForegroundColor Gray
Write-Host ""
Write-Host "  3. 按 deploy/DEPLOY_GUIDE.md 进行部署" -ForegroundColor White
Write-Host ""
