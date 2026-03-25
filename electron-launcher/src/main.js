const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { exec } = require('child_process');
const log = require('electron-log');

log.transports.file.level = 'info';
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'launcher.log');

log.info('=== OpenClaw Launcher 启动 ===');

let mainWindow = null;
let tray = null;
let httpServer = null;

const HTTP_PORT = 18790;

function startHttpServer() {
  httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${HTTP_PORT}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (url.pathname === '/api/check' || url.pathname === '/api/status') {
      const port = await detectOpenClawPort();
      const installed = checkOpenClawInstalled();

      const result = {
        success: true,
        installed: installed.installed,
        directory: installed.directory,
        version: installed.version,
        gatewayPort: port,
        gatewayRunning: !!port,
        platform: process.platform,
        arch: process.arch
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (url.pathname === '/api/launch') {
      exec('openclaw', (error) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: !error, error: error?.message }));
      });
      return;
    }

    if (url.pathname === '/api/install') {
      const command = 'npm install -g openclaw';
      log.info('执行安装命令:', command);
      exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
        if (error) {
          log.error('安装失败:', error.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message, stderr: stderr }));
          return;
        }
        log.info('安装成功:', stdout);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '安装成功', stdout: stdout }));
      });
      return;
    }

    if (url.pathname === '/api/upgrade') {
      const command = 'npm update -g openclaw';
      log.info('执行升级命令:', command);
      exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
        if (error) {
          log.error('升级失败:', error.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message, stderr: stderr }));
          return;
        }
        log.info('升级成功:', stdout);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '升级成功', stdout: stdout }));
      });
      return;
    }

    if (url.pathname === '/api/auto-upgrade') {
      const command = 'npm install -g electron';
      log.info('执行Launcher自动升级命令:', command);
      exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
        if (error) {
          log.error('自动升级失败:', error.message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message, stderr: stderr }));
          return;
        }
        log.info('自动升级成功，需要重启应用');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '自动升级成功，需要重启应用', stdout: stdout }));
      });
      return;
    }

    if (url.pathname === '/api/command') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { command, timeout = 60000 } = JSON.parse(body);
          if (!command) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: '缺少command参数' }));
            return;
          }
          log.info('执行自定义命令:', command);
          exec(command, { timeout }, (error, stdout, stderr) => {
            if (error) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: error.message, stderr: stderr }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, stdout: stdout, stderr: stderr }));
          });
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  httpServer.listen(HTTP_PORT, () => {
    log.info(`HTTP API 服务器已启动: http://127.0.0.1:${HTTP_PORT}`);
  });

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log.warn(`端口 ${HTTP_PORT} 被占用，HTTP 服务未启动`);
    } else {
      log.error('HTTP 服务器错误:', err);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: true,
    transparent: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('src/index.html');

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      log.info('窗口已隐藏到托盘');
    }
  });

  log.info('主窗口已创建');
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  let trayIcon;

  try {
    if (fs.existsSync(iconPath)) {
      trayIcon = nativeImage.createFromPath(iconPath);
    } else {
      trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFhSURBVDiNpZM9SwNBEIa/uZRLiYUgaGFhYWNhYSX4A/wFNhYWFv4AFhZWVhYWFv4AFhZWFhYWFv4AFhZWFhYWgoiFYFPkLnbW7tzu3l0uHELLwjDz5s2bN7M7C/+xqVoUBMHtRqNxNAzDy+l0+r7T6XwYDocX4/E4bbfbjvC6KIqT0WjUAuDVaDR6Nx6P3w6HwzfT6fRDo9G4kM7Z8Twv7XQ6LwF8G41G78bj8dvZbPah1+sdm81mU9M0bdu27XQ63Qbgy3g8fjsej9/1+/1X3W73yMnJCVc9fvw4BXA8mUze3t/fv2232y9PT0+5jo+Pj7lx40Ya4HK5fPfp06f3tVrt6OLi4oVOp3PG2dnZOTdJJpPJ+1ar9bper/9eq9WeN5vNF81m84Vz6f8X/gAw7P2bN3qZIgAAAABJRU5ErkJggg==');
    }
  } catch (e) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '退出',
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('OpenClaw Launcher');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  log.info('系统托盘已创建');
}

function registerProtocol() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('openclaw', process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient('openclaw');
  }
  log.info('自定义协议 openclaw:// 已注册');
}

function handleProtocolUrl(url) {
  log.info('收到协议请求:', url);

  if (!url || !url.startsWith('openclaw://')) {
    return;
  }

  const urlObj = new URL(url);
  const command = urlObj.host || urlObj.pathname.replace(/^\/+/, '');
  const params = Object.fromEntries(urlObj.searchParams);

  log.info('解析命令:', command, '参数:', params);

  if (mainWindow) {
    mainWindow.webContents.send('protocol-command', { command, params });
  }
}

app.whenReady().then(() => {
  registerProtocol();
  startHttpServer();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});

app.on('second-instance', (event, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }

  const url = commandLine.find(arg => arg.startsWith('openclaw://'));
  if (url) {
    handleProtocolUrl(url);
  }
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

const OPENCLAW_PORTS = [18789, 18790, 18791, 18792, 18793, 18794, 18795];

function checkPort(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function detectOpenClawPort() {
  for (const port of OPENCLAW_PORTS) {
    const isOpen = await checkPort(port);
    if (isOpen) {
      log.info(`检测到 OpenClaw Gateway 端口: ${port}`);
      return port;
    }
  }
  return null;
}

function getOpenClawDirectory() {
  const home = process.env.USERPROFILE || process.env.HOME || process.env.USERPROFILE;
  if (!home) return null;

  const possiblePaths = [
    path.join(home, '.openclaw'),
    path.join(home, 'AppData', 'Local', 'openclaw'),
    path.join(home, 'AppData', 'Roaming', 'openclaw')
  ];

  for (const dirPath of possiblePaths) {
    try {
      if (fs.existsSync(dirPath)) {
        const stats = fs.statSync(dirPath);
        if (stats.isDirectory()) {
          log.info(`找到 OpenClaw 目录: ${dirPath}`);
          return dirPath;
        }
      }
    } catch (e) {
      log.warn(`检查目录失败: ${dirPath}`, e.message);
    }
  }

  return null;
}

function checkOpenClawInstalled() {
  const openclawDir = getOpenClawDirectory();
  const versionFile = openclawDir ? path.join(openclawDir, 'version.txt') : null;
  let version = 'unknown';
  let commandAvailable = false;

  if (versionFile && fs.existsSync(versionFile)) {
    try {
      version = fs.readFileSync(versionFile, 'utf8').trim();
    } catch (e) {
      log.warn('读取版本文件失败:', e.message);
    }
  }

  try {
    const { execSync } = require('child_process');
    execSync('openclaw --version', { encoding: 'utf8', timeout: 5000 });
    commandAvailable = true;
  } catch (e) {
    commandAvailable = false;
  }

  return {
    installed: !!openclawDir,
    commandAvailable: commandAvailable,
    directory: openclawDir,
    version: version
  };
}

function getSystemInfo() {
  const platform = process.platform;
  const arch = process.arch;
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const username = process.env.USERNAME || process.env.USER || 'unknown';

  return {
    platform,
    arch,
    home,
    username,
    openclaw: checkOpenClawInstalled()
  };
}

ipcMain.handle('get-system-info', async () => {
  log.info('收到系统信息请求');
  return getSystemInfo();
});

ipcMain.handle('check-openclaw', async () => {
  log.info('收到检查 OpenClaw 请求');
  const port = await detectOpenClawPort();
  const installed = checkOpenClawInstalled();

  return {
    ...installed,
    gatewayPort: port,
    gatewayRunning: !!port
  };
});

ipcMain.handle('launch-openclaw', async () => {
  log.info('收到启动 OpenClaw 请求');

  const openclawCmd = process.platform === 'win32' ? 'openclaw' : 'openclaw';

  return new Promise((resolve) => {
    exec(openclawCmd, (error, stdout, stderr) => {
      if (error) {
        log.error('启动 OpenClaw 失败:', error.message);
        resolve({ success: false, error: error.message });
      } else {
        log.info('启动 OpenClaw 命令已执行');
        resolve({ success: true });
      }
    });
  });
});

ipcMain.handle('check-port', async (event, port) => {
  return await checkPort(port);
});

ipcMain.handle('get-installed', async () => {
  return checkOpenClawInstalled();
});

log.info('IPC 处理器已注册');
