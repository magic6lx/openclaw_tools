function uuidv4() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const STORAGE_KEY = 'openclaw_device_identity';

function getPlatform() {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) return 'windows';
  if (platform.includes('mac')) return 'macos';
  if (platform.includes('linux')) return 'linux';
  return 'unknown';
}

async function generateDeviceIdentity() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.deviceId && parsed.privateKey && parsed.publicKey) {
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse stored device identity:', e);
    }
  }

  const keyPair = await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,
    ['sign', 'verify']
  );

  const publicKeyBuffer = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  
  const publicKey = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));
  const privateKey = btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)));
  
  const deviceIdBuffer = await crypto.subtle.digest('SHA-256', publicKeyBuffer);
  const deviceId = Array.from(new Uint8Array(deviceIdBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const identity = {
    version: 1,
    deviceId,
    publicKey,
    privateKey,
    createdAtMs: Date.now()
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

async function signPayload(payload, privateKeyBase64) {
  const privateKeyBuffer = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));
  
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    { name: 'Ed25519' },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  
  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' },
    privateKey,
    data
  );
  
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

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
    this.authenticated = false;
    this.lastStatus = null;
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.connectResolve = null;
    this.connectReject = null;
    this.deviceIdentity = null;
    this.challengeNonce = null;
  }

  async initDeviceIdentity() {
    if (!this.deviceIdentity) {
      try {
        this.deviceIdentity = await generateDeviceIdentity();
        console.log('设备身份已初始化:', this.deviceIdentity.deviceId);
      } catch (e) {
        console.error('初始化设备身份失败:', e);
      }
    }
    return this.deviceIdentity;
  }

  async buildConnectParams(nonce) {
    const identity = await this.initDeviceIdentity();
    if (!identity) {
      throw new Error('无法初始化设备身份');
    }

    const now = Date.now();
    const clientId = 'webchat';
    const clientMode = 'operator';
    const role = 'operator';
    const scopes = ['operator.read', 'operator.write'];
    const token = '';

    const authPayload = `v1|${identity.deviceId}|${clientId}|${clientMode}|${role}|${scopes.join(',')}|${now}|${token}`;
    
    let signature;
    try {
      signature = await signPayload(authPayload, identity.privateKey);
    } catch (e) {
      console.error('签名失败:', e);
      signature = '';
    }

    return {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: clientId,
        version: '1.0.0',
        platform: getPlatform(),
        mode: clientMode
      },
      role: role,
      scopes: scopes,
      caps: [],
      commands: [],
      permissions: {},
      auth: token ? { token } : {},
      locale: 'zh-CN',
      userAgent: 'openclaw-tools/1.0.0',
      device: {
        id: identity.deviceId,
        publicKey: identity.publicKey,
        signature: signature,
        signedAt: now,
        nonce: nonce
      }
    };
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log('正在连接OpenClaw Gateway...');

        if (this.ws) {
          this.ws.close();
        }

        this.authenticated = false;
        this.connectResolve = resolve;
        this.connectReject = reject;

        this.ws = new WebSocket(this.gatewayUrl);

        this.ws.onopen = () => {
          console.log('OpenClaw Gateway连接成功，等待认证...');
          this.isConnected = true;
        };

        this.ws.onclose = (event) => {
          console.log('OpenClaw Gateway连接关闭', event.code, event.reason);
          this.isConnected = false;
          this.authenticated = false;
          this.notifyListeners('close', event);
          this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('OpenClaw Gateway连接错误:', error);
          this.notifyListeners('error', error);
          if (this.connectReject) {
            this.connectReject(error);
            this.connectReject = null;
          }
        };

        this.ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('收到Gateway消息:', data);

            if (data.type === 'event' && data.event === 'connect.challenge') {
              console.log('收到连接挑战:', data.payload);
              const nonce = typeof data.payload === 'object' ? data.payload.nonce : data.payload;
              this.challengeNonce = nonce;
              
              if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                  const connectParams = await this.buildConnectParams(nonce);
                  const connectRequest = {
                    type: 'req',
                    id: uuidv4(),
                    method: 'connect',
                    params: connectParams
                  };
                  console.log('发送 connect 请求:', connectRequest);
                  this.ws.send(JSON.stringify(connectRequest));
                } catch (e) {
                  console.error('构建 connect 请求失败:', e);
                }
              }
              return;
            }

            if (data.type === 'res') {
              if (data.ok && data.payload && data.payload.type === 'hello-ok') {
                console.log('认证成功:', data.payload);
                this.authenticated = true;
                this.notifyListeners('open');
                if (this.connectResolve) {
                  this.connectResolve(true);
                  this.connectResolve = null;
                }
                if (this.reconnectTimer) {
                  clearTimeout(this.reconnectTimer);
                  this.reconnectTimer = null;
                }
                return;
              }

              if (this.pendingRequests.size > 0) {
                const requestId = data.id;
                if (requestId && this.pendingRequests.has(requestId)) {
                  const { resolve, reject, timeoutId } = this.pendingRequests.get(requestId);
                  clearTimeout(timeoutId);
                  this.pendingRequests.delete(requestId);
                  if (data.ok) {
                    resolve(data.payload || data);
                  } else {
                    reject(new Error(data.error || 'Command failed'));
                  }
                } else if (this.pendingRequests.size > 0) {
                  const [key, { resolve, reject, timeoutId }] = this.pendingRequests.entries().next().value;
                  clearTimeout(timeoutId);
                  this.pendingRequests.delete(key);
                  if (data.ok) {
                    resolve(data.payload || data);
                  } else {
                    reject(new Error(data.error || 'Command failed'));
                  }
                }
              }
              return;
            }

            if (data.type === 'status') {
              this.lastStatus = data.payload;
              this.notifyListeners('status', data.payload);
            } else if (data.type === 'event') {
              if (data.event === 'status') {
                this.lastStatus = data.payload;
                this.notifyListeners('status', data.payload);
              } else if (data.event === 'installProgress') {
                this.notifyListeners('installProgress', data.payload);
              } else if (data.event === 'commandResult') {
                this.notifyListeners('commandResult', data.payload);
              }
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

  sendRequest(method, params = {}, timeout = 60000) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Gateway未连接'));
        return;
      }

      if (!this.authenticated) {
        reject(new Error('Gateway未认证'));
        return;
      }

      const requestId = uuidv4();

      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('请求超时'));
        }
      }, timeout);

      this.pendingRequests.set(requestId, { resolve, reject, timeoutId });

      const message = JSON.stringify({
        type: 'req',
        id: requestId,
        method: method,
        params: params
      });
      console.log('发送 WebSocket 消息:', message);
      this.ws.send(message);
    });
  }

  requestStatus() {
    console.log('发送 status 请求...');
    return this.sendRequest('status');
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.authenticated) {
      this.ws.send(JSON.stringify({
        type: 'req',
        id: uuidv4(),
        method: command,
        params: params
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
    this.authenticated = false;

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
          console.error(`Listener error for ${event}:`, e);
        }
      });
    }
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected && this.authenticated,
      url: this.gatewayUrl
    };
  }
}

const openClawGatewayService = new OpenClawGatewayService();
export default openClawGatewayService;
