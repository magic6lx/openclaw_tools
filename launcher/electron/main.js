const { app, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const launcher = require('./index');

let tray = null;
const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:3002';

function createTray() {
  const iconPath = path.join(__dirname, '../assets/icon.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch (err) {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('OpenClaw Launcher');

  const contextMenu = Menu.buildFromTemplate([
    { label: '启动', click: () => launcher.log('INFO', '用户点击启动') },
    { label: '停止', click: () => launcher.log('INFO', '用户点击停止') },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]);

  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  launcher.setServerUrl(SERVER_URL);
  launcher.start(30000);
  createTray();
});

app.on('window-all-closed', () => {});
app.on('before-quit', () => launcher.stop());
