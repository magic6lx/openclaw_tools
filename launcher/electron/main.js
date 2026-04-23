const { app, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const launcher = require('../src/index');

let tray = null;
const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:3002';

function createTray() {
  const iconPath = path.join(__dirname, '../assets/icon.ico');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty();
    }
  } catch (err) {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('OpenClaw Launcher');

  updateMenu();

  tray.on('click', () => {
    const status = launcher.getStatus();
    console.log('当前状态:', JSON.stringify(status, null, 2));
  });
}

function updateMenu() {
  const status = launcher.getStatus();
  
  const contextMenu = Menu.buildFromTemplate([
    { label: `设备ID: ${status.deviceId?.slice(0, 8)}...`, enabled: false },
    { type: 'separator' },
    { label: `OpenClaw: ${status.openClawStatus}`, enabled: false },
    { label: `Gateway: ${status.gatewayRunning ? '运行中' : '已停止'}`, enabled: false },
    { label: `待上传日志: ${status.logsCount}`, enabled: false },
    { type: 'separator' },
    { 
      label: '启动 Gateway', 
      click: async () => {
        launcher.log('INFO', '用户点击启动Gateway');
        const result = await launcher.startGateway();
        updateMenu();
      },
      enabled: !status.gatewayRunning
    },
    { 
      label: '停止 Gateway', 
      click: async () => {
        launcher.log('INFO', '用户点击停止Gateway');
        await launcher.stopGateway();
        updateMenu();
      },
      enabled: status.gatewayRunning
    },
    { 
      label: '检查状态', 
      click: () => {
        launcher.checkOpenClawStatus();
        updateMenu();
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]);

  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  launcher.setServerUrl(SERVER_URL);
  launcher.start(30000);
  launcher.startLocalApi();
  createTray();
});

app.on('window-all-closed', () => {});
app.on('before-quit', () => launcher.stop());
