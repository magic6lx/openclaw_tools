const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const launcherDir = path.join(__dirname, '..');
const distNew = path.join(launcherDir, 'dist_new');
const outputDir = path.join(launcherDir, 'dist');
const version = '1.0.2';
const zipName = `OpenClawLauncher-win-x64-v${version}.zip`;
const outputZip = path.join(outputDir, zipName);

console.log('========================================');
console.log('  OpenClaw Launcher 构建脚本');
console.log('========================================');
console.log('');

console.log('[1/4] 清理输出目录...');
if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true });
}
fs.mkdirSync(outputDir, { recursive: true });

console.log('[2/4] 复制源码到输出目录...');
const files = fs.readdirSync(distNew);
for (const f of files) {
  const src = path.join(distNew, f);
  const dest = path.join(outputDir, f);
  if (fs.statSync(src).isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.copyFileSync(src, dest);
  }
  console.log(`  复制: ${f}`);
}

console.log('[3/4] 复制 node_modules...');
const nodeModulesSrc = path.join(launcherDir, 'node_modules');
const nodeModulesDest = path.join(outputDir, 'node_modules');
if (fs.existsSync(nodeModulesSrc)) {
  fs.cpSync(nodeModulesSrc, nodeModulesDest, { recursive: true });
  console.log('  复制: node_modules');
}

console.log('[4/4] 创建压缩包...');
if (fs.existsSync(outputZip)) {
  fs.unlinkSync(outputZip);
}
execSync(`powershell -Command "Compress-Archive -Path '${outputDir}\\*' -DestinationPath '${outputZip}'"`);

const zipSize = (fs.statSync(outputZip).size / 1024 / 1024).toFixed(2);
console.log('');
console.log('========================================');
console.log('  构建完成！');
console.log('========================================');
console.log(`  输出文件: ${outputZip}`);
console.log(`  文件大小: ${zipSize} MB`);
console.log(`  版本: v${version}`);
console.log('');