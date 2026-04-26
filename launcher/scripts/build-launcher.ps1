$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot "launcher\dist_new"
$outputDir = Join-Path $projectRoot "launcher\dist"
$zipName = "OpenClawLauncher-win-x64.zip"
$outputZip = Join-Path $outputDir $zipName

Write-Host "========================================"
Write-Host "  OpenClaw Launcher 构建脚本"
Write-Host "========================================"
Write-Host ""

if (-not (Test-Path $distPath)) {
    Write-Host "[ERROR] dist_new 目录不存在: $distPath" -ForegroundColor Red
    Write-Host "请先创建 dist_new 目录和内容" -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/3] 清理输出目录..."
if (Test-Path $outputDir) {
    Remove-Item -Recurse -Force $outputDir
}
New-Item -ItemType Directory -Path $outputDir | Out-Null

Write-Host "[2/3] 复制文件到输出目录..."
Copy-Item -Path "$distPath\*" -Destination $outputDir -Recurse

Write-Host "[3/3] 创建压缩包..."
if (Test-Path $outputZip) {
    Remove-Item $outputZip
}
Compress-Archive -Path "$outputDir\*" -DestinationPath $outputZip -CompressionLevel Optimal

$zipSize = (Get-Item $outputZip).Length / 1MB
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  构建完成！" -ForegroundColor Green
Write-Host "========================================"
Write-Host "  输出文件: $outputZip"
Write-Host "  文件大小: $([math]::Round($zipSize, 2)) MB"
Write-Host ""
Write-Host "分发步骤:"
Write-Host "  1. 上传 $zipName 到服务器"
Write-Host "  2. 放到可下载目录"
Write-Host "  3. 用户下载解压后双击 start.bat"
Write-Host ""
