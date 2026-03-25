const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  checkOpenClaw: () => ipcRenderer.invoke('check-openclaw'),
  launchOpenClaw: () => ipcRenderer.invoke('launch-openclaw'),
  checkPort: (port) => ipcRenderer.invoke('check-port', port),
  getInstalled: () => ipcRenderer.invoke('get-installed'),

  onProtocolCommand: (callback) => {
    ipcRenderer.on('protocol-command', (event, data) => callback(data));
  }
});
