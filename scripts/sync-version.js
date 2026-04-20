const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const VERSION_FILE = path.join(PROJECT_ROOT, 'version.json');

function loadVersion() {
  const content = fs.readFileSync(VERSION_FILE, 'utf-8');
  return JSON.parse(content);
}

function saveVersion(version) {
  fs.writeFileSync(VERSION_FILE, JSON.stringify(version, null, 2) + '\n');
}

function updateTauriConfig(version) {
  const configPath = path.join(PROJECT_ROOT, 'openclaw-launcher', 'src-tauri', 'tauri.conf.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  config.version = version;
  config.productName = `OpenClaw Launcher v${version}`;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log('Updated: tauri.conf.json');
}

function updateLauncherDist(version) {
  const indexPath = path.join(PROJECT_ROOT, 'openclaw-launcher', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf-8');
    content = content.replace(/v\d+\.\d+\.\d+/g, `v${version}`);
    fs.writeFileSync(indexPath, content);
    console.log('Updated: openclaw-launcher/dist/index.html');
  }
}

function updateBuildScript(version) {
  const scriptPath = path.join(PROJECT_ROOT, 'scripts', 'build-local-launcher.ps1');
  if (fs.existsSync(scriptPath)) {
    let content = fs.readFileSync(scriptPath, 'utf-8');
    const exeName = `OpenClaw-Launcher-v${version}.exe`;
    content = content.replace(/OpenClaw-Launcher-v\d+\.\d+\.\d+\.exe/g, exeName);
    fs.writeFileSync(scriptPath, content);
    console.log('Updated: build-local-launcher.ps1');
  }
}

function updateFrontend(version) {
  const exeName = `OpenClaw-Launcher-v${version}.exe`;

  const installPath = path.join(PROJECT_ROOT, 'frontend', 'src', 'pages', 'OpenClawInstall.jsx');
  if (fs.existsSync(installPath)) {
    let content = fs.readFileSync(installPath, 'utf-8');
    content = content.replace(/OpenClaw-Launcher-v\d+\.\d+\.\d+\.exe/g, exeName);
    fs.writeFileSync(installPath, content);
    console.log('Updated: OpenClawInstall.jsx');
  }

  const blockerPath = path.join(PROJECT_ROOT, 'frontend', 'src', 'services', 'LauncherBlocker.jsx');
  if (fs.existsSync(blockerPath)) {
    let content = fs.readFileSync(blockerPath, 'utf-8');
    content = content.replace(/OpenClaw-Launcher-v\d+\.\d+\.\d+\.exe/g, exeName);
    fs.writeFileSync(blockerPath, content);
    console.log('Updated: LauncherBlocker.jsx');
  }
}

function updateBackend(version) {
  const indexPath = path.join(PROJECT_ROOT, 'backend', 'src', 'index.js');
  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf-8');
    content = content.replace(/\/OpenClaw-Launcher-v\d+\.\d+\.\d+\.exe/g, `/OpenClaw-Launcher-v${version}.exe`);
    fs.writeFileSync(indexPath, content);
    console.log('Updated: backend/index.js');
  }
}

function syncVersion(newVersion) {
  console.log(`\nSyncing version to ${newVersion}...\n`);

  const versionData = loadVersion();
  versionData.version = newVersion;
  versionData.components.launcher.version = newVersion;
  versionData.components.launcher.exeName = `OpenClaw-Launcher-v${newVersion}.exe`;
  versionData.components.frontend.version = newVersion;
  versionData.components.backend.version = newVersion;
  saveVersion(versionData);
  console.log('Updated: version.json');

  updateTauriConfig(newVersion);
  updateLauncherDist(newVersion);
  updateBuildScript(newVersion);
  updateFrontend(newVersion);
  updateBackend(newVersion);

  console.log(`\n✅ Version synced to ${newVersion}\n`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  const v = loadVersion();
  console.log(`Current version: ${v.version}`);
  console.log(`\nUsage: node sync-version.js <version>`);
  console.log(`Example: node sync-version.js 1.0.4`);
  process.exit(0);
}

const newVersion = args[0];
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('Version must be in format: x.y.z (e.g., 1.0.4)');
  process.exit(1);
}

syncVersion(newVersion);
