Stop-Process -Name "electron" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "OpenClaw" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Remove-Item -Recurse -Force "d:\Tu工作同步\My工作同步\openclaw_tools\launcher\dist_new" -ErrorAction SilentlyContinue
Write-Host "Done"
