class OpenClawGatewayService {
  constructor() {
    this.ws = null;
    this.gatewayUrl = 'ws://127.0.0.1:18789';
    this.reconnectInterval = 5000;
    this.reconnectTimer = null;
    this.listeners = {
      open: [],
      close: [],
      error: [],
      message: [],
      status: [],
      installProgress: [],
      commandResult: []
    };
    this.isConnected = false;
    this.lastStatus = null;
    this.pendingRequests = new Map();
    this.requestId = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log('正在连接OpenClaw Gateway...');

        if (this.ws) {
          this.ws.close();
        }

        this.ws = new WebSocket(this.gatewayUrl);

        this.ws.onopen = () => {
          console.log('OpenClaw Gateway连接成功');
          this.isConnected = true;
          this.notifyListeners('open');

          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }

          resolve(true);
        };

        this.ws.onclose = (event) => {
          console.log('OpenClaw Gateway连接关闭', event.code, event.reason);
          this.isConnected = false;
          this.notifyListeners('close', event);
          this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('OpenClaw Gateway连接错误:', error);
          this.notifyListeners('error', error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('收到Gateway消息:', data);

            if (data.requestId && this.pendingRequests.has(data.requestId)) {
              const { resolve, reject, timeoutId } = this.pendingRequests.get(data.requestId);
              clearTimeout(timeoutId);
              this.pendingRequests.delete(data.requestId);

              if (data.success) {
                resolve(data.payload || data);
              } else {
                reject(new Error(data.error || 'Command failed'));
              }
              return;
            }

            if (data.type === 'status') {
              this.lastStatus = data.payload;
              this.notifyListeners('status', data.payload);
            } else if (data.type === 'installProgress') {
              this.notifyListeners('installProgress', data.payload);
            } else if (data.type === 'commandResult') {
              this.notifyListeners('commandResult', data.payload);
            }

            this.notifyListeners('message', data);
          } catch (e) {
            console.error('解析Gateway消息失败:', e);
            this.notifyListeners('message', event.data);
          }
        };
      } catch (error) {
        console.error('创建WebSocket连接失败:', error);
        reject(error);
      }
    });
  }

  sendRequest(command, payload = {}, timeout = 60000) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Gateway未连接'));
        return;
      }

      const requestId = ++this.requestId;

      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('请求超时'));
        }
      }, timeout);

      this.pendingRequests.set(requestId, { resolve, reject, timeoutId });

      this.ws.send(JSON.stringify({
        requestId,
        type: command,
        ...payload
      }));
    });
  }

  requestStatus() {
    return this.sendRequest('getStatus');
  }

  checkSystem() {
    return this.sendRequest('checkSystem');
  }

  installOpenClaw(upgrade = false) {
    return this.sendRequest('install', { upgrade }, 300000);
  }

  verifyInstallation() {
    return this.sendRequest('verifyInstallation');
  }

  detectDirectories() {
    return this.sendRequest('detectDirectories');
  }

  importConfig(directoryPath, options = {}) {
    return this.sendRequest('importConfig', { directoryPath, ...options });
  }

  exportConfig(configData, targetPath) {
    return this.sendRequest('exportConfig', { configData, targetPath });
  }

  startOpenClaw() {
    return this.sendRequest('start');
  }

  stopOpenClaw() {
    return this.sendRequest('stop');
  }

  restartOpenClaw() {
    return this.sendRequest('restart');
  }

  getLogs(lines = 100) {
    return this.sendRequest('getLogs', { lines });
  }

  sendCommand(command, params = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: command,
        ...params
      }));
      return true;
    }
    return false;
  }

  scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    console.log(`${this.reconnectInterval/1000}秒后尝试重新连接...`);

    this.reconnectTimer = setTimeout(() => {
      console.log('尝试重新连接OpenClaw Gateway...');
      this.reconnectTimer = null;
      this.connect().catch(err => {
        console.error('重新连接失败:', err);
      });
    }, this.reconnectInterval);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;

    this.pendingRequests.forEach(({ timeoutId }) => clearTimeout(timeoutId));
    this.pendingRequests.clear();
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  notifyListeners(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`事件监听器执行错误 (${event}):`, e);
        }
      });
    }
  }

  async checkGatewayAvailable() {
    try {
      const response = await fetch('http://127.0.0.1:18789/api/status', {
        method: 'GET',
        mode: 'no-cors',
        timeout: 3000
      });
      return true;
    } catch (error) {
      console.log('Gateway不可用:', error);
      return false;
    }
  }

  isInstalled() {
    return this.isConnected && this.lastStatus && !this.lastStatus.error;
  }
}

const openClawGatewayService = new OpenClawGatewayService();
export default openClawGatewayService;