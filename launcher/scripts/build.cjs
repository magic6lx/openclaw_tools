const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const launcherDir = path.join(__dirname, '..');
const distDir = path.join(launcherDir, 'dist');
const version = '1.0.2';
const zipName = `OpenClawLauncher-win-x64-v${version}.zip`;
const outputZip = path.join(distDir, zipName);

console.log('========================================');
console.log('  OpenClaw Launcher 构建脚本');
console.log('========================================');
console.log('');

console.log('[1/5] 清理 dist 目录...');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(path.join(distDir, 'config'), { recursive: true });

console.log('[2/5] 复制 index.js...');
fs.copyFileSync(path.join(launcherDir, 'src', 'index.js'), path.join(distDir, 'index.js'));

console.log('[3/5] 复制 config 目录...');
const configSrc = path.join(launcherDir, 'config');
if (fs.existsSync(configSrc)) {
  const configFiles = fs.readdirSync(configSrc);
  for (const f of configFiles) {
    fs.copyFileSync(path.join(configSrc, f), path.join(distDir, 'config', f));
  }
}

console.log('[4/5] 复制 node_modules...');
const nodeModulesSrc = path.join(launcherDir, 'node_modules');
const nodeModulesDest = path.join(distDir, 'node_modules');
if (fs.existsSync(nodeModulesSrc)) {
  console.log('  使用 xcopy 复制 node_modules...');
  try {
    execSync(`xcopy /E /I /Y "${nodeModulesSrc}" "${nodeModulesDest}"`, { stdio: 'inherit' });
  } catch (e) {
    console.log('  xcopy 失败，尝试 robocopy...');
    try {
      execSync(`robocopy "${nodeModulesSrc}" "${nodeModulesDest}" /E /MIR /NP /NS /NC /NFL /NDL /NJH /NJS`, { stdio: 'inherit' });
    } catch (e2) {
      console.log('  robocopy 也失败了');
    }
  }
}

console.log('[5/5] 创建 start.bat...');
const startBat = `@echo off
echo ========================================
echo   OpenClaw Launcher
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo Node.js not found! Please install from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js found:
node -v
echo.

echo [2/3] Starting Launcher service...
start "OpenClaw-Launcher" cmd /k "node index.js"

echo [3/3] Waiting for service...
timeout /t 2 /nobreak > nul

echo Done! Launcher should be running on port 3003.
echo Press any key to exit this window...
pause > nul
`;
fs.writeFileSync(path.join(distDir, 'start.bat'), startBat);

console.log('');
console.log('[打包] 创建压缩包...');
if (fs.existsSync(outputZip)) {
  fs.unlinkSync(outputZip);
}
execSync(`powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${outputZip}' -Force"`);

const zipSize = (fs.statSync(outputZip).size / 1024 / 1024).toFixed(2);
console.log('');
console.log('========================================');
console.log('  构建完成！');
console.log('========================================');
console.log(`  输出文件: ${outputZip}`);
console.log(`  文件大小: ${zipSize} MB`);
console.log(`  版本: v${version}`);
console.log('');
