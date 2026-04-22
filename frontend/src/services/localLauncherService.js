const LAUNCHER_API_BASE = 'http://127.0.0.1:18790';

let tauriInvoke = null;
let tauriListen = null;

const isTauri = () => {
  return typeof window !== 'undefined' && window.__TAURI__;
};

const getTauriApi = async () => {
  if (!tauriInvoke && isTauri()) {
    try {
      const tauri = await import('@tauri-apps/api');
      tauriInvoke = tauri.invoke;
      tauriListen = tauri.listen;
    } catch (e) {
      console.log('Tauri API not available:', e);
    }
  }
  return { invoke: tauriInvoke, listen: tauriListen };
};

class LocalLauncherService {
  async checkOpenClawStatus() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/check`, {
        method: 'GET',
        mode: 'cors',
        timeout: 5000
      });

      if (!response.ok) {
        return {
          available: false,
          error: 'Launcher服务未运行',
          installed: false,
          gatewayRunning: false
        };
      }

      const data = await response.json();

      return {
        available: true,
        installed: data.installed || false,
        commandAvailable: data.commandAvailable || false,
        directory: data.directory || null,
        version: data.version || 'unknown',
        gatewayRunning: data.gateway_running || false,
        gatewayPort: data.gateway_port || null,
        platform: data.platform || 'unknown',
        arch: data.arch || 'unknown'
      };
    } catch (error) {
      console.log('Launcher API不可用:', error.message);
      return {
        available: false,
        error: 'Launcher服务未启动，请先运行OpenClaw Launcher',
        installed: false,
        gatewayRunning: false
      };
    }
  }

  async launchOpenClaw() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/launch`, {
        method: 'POST',
        mode: 'cors',
        timeout: 10000
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'Launcher未运行，请双击桌面图标重新打开'
        };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: 'Launcher未运行，请双击桌面图标重新打开'
      };
    }
  }

  async getSystemInfo() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/system-info`, {
        method: 'GET',
        mode: 'cors',
        timeout: 5000
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        success: true,
        platform: data.platform,
        arch: data.arch,
        nodeVersion: data.node_version,
        npmVersion: data.npm_version,
        diskSpaceGb: data.disk_space_gb,
        openclawInstalled: data.openclaw_installed,
        openclawVersion: data.openclaw_version,
        openclawDirectory: data.openclaw_directory,
        gatewayRunning: data.gateway_running,
        gatewayPort: data.gateway_port
      };
    } catch (error) {
      console.log('获取系统信息失败:', error.message);
      return null;
    }
  }

  async installOpenClaw() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/install`, {
        method: 'POST',
        mode: 'cors',
        timeout: 300000
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async installOpenClawNpm() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/install-npm`, {
        method: 'POST',
        mode: 'cors'
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getInstallLogs() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/install/logs`, {
        method: 'GET',
        mode: 'cors'
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        logs: [],
        installing: false,
        error: error.message
      };
    }
  }

  async stopGateway() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/stop-gateway`, {
        method: 'POST',
        mode: 'cors',
        timeout: 10000
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'Launcher未运行'
        };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async upgradeOpenClaw() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/upgrade`, {
        method: 'POST',
        mode: 'cors',
        timeout: 300000
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async autoUpgradeLauncher() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/auto-upgrade`, {
        method: 'POST',
        mode: 'cors',
        timeout: 300000
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeCommand(command, timeout = 60000) {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/command`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command, timeout })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  isLauncherRunning() {
    return fetch(`${LAUNCHER_API_BASE}/api/check`, {
      method: 'HEAD',
      mode: 'cors',
      cache: 'no-cache'
    }).then(() => true).catch(() => false);
  }

  async clearDeviceAuth() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/clear-device-auth`, {
        method: 'POST',
        mode: 'cors'
      });
      if (response.ok) {
        return { success: true, message: 'Device auth cache cleared' };
      }
      return { success: false, error: 'Failed to clear device auth' };
    } catch (error) {
      return { success: false, error: error.message || 'Failed to clear device auth' };
    }
  }

  async getLogs(lines = 100) {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/logs?lines=${lines}`, {
        method: 'GET',
        mode: 'cors',
        timeout: 10000
      });

      if (!response.ok) {
        return {
          success: false,
          logs: '',
          error: 'Launcher未运行'
        };
      }

      const data = await response.json();
      return {
        success: data.success,
        logs: data.logs || '',
        error: null
      };
    } catch (error) {
      return {
        success: false,
        logs: '',
        error: error.message
      };
    }
  }

  async detectConfig() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/config/detect`, {
        method: 'GET',
        mode: 'cors',
        timeout: 10000
      });

      if (!response.ok) {
        return { success: false, found: false, error: 'Launcher未运行' };
      }

      return await response.json();
    } catch (error) {
      return { success: false, found: false, error: error.message };
    }
  }

  async getConfigFiles() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/config/files`, {
        method: 'GET',
        mode: 'cors',
        timeout: 10000
      });

      if (!response.ok) {
        return { success: false, files: [], error: 'Launcher未运行' };
      }

      return await response.json();
    } catch (error) {
      return { success: false, files: [], error: error.message };
    }
  }

  async readConfigFile(path) {
    try {
      const encodedPath = encodeURIComponent(path);
      const response = await fetch(`${LAUNCHER_API_BASE}/api/config/read?path=${encodedPath}`, {
        method: 'GET',
        mode: 'cors',
        timeout: 10000
      });

      if (!response.ok) {
        return { success: false, content: null, error: 'Launcher未运行' };
      }

      return await response.json();
    } catch (error) {
      return { success: false, content: null, error: error.message };
    }
  }

  async writeConfigFile(path, content) {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/config/write`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ path, content }),
        timeout: 10000
      });

      if (!response.ok) {
        return { success: false, error: 'Launcher未运行' };
      }

      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async backupConfig() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/config/backup`, {
        method: 'POST',
        mode: 'cors',
        timeout: 30000
      });

      if (!response.ok) {
        return { success: false, error: 'Launcher未运行' };
      }

      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async listBackups() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/config/backups`, {
        method: 'GET',
        mode: 'cors',
        timeout: 10000
      });

      if (!response.ok) {
        return { success: false, backups: [], error: 'Launcher未运行' };
      }

      return await response.json();
    } catch (error) {
      return { success: false, backups: [], error: error.message };
    }
  }

  async restoreConfig(backupName) {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/config/restore`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ backupName }),
        timeout: 30000
      });

      if (!response.ok) {
        return { success: false, error: 'Launcher未运行' };
      }

      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getConsoleLogs(since = 0) {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/console/logs?since=${since}`, {
        method: 'GET',
        mode: 'cors',
        timeout: 10000
      });

      if (!response.ok) {
        return { success: false, logs: [], error: 'Launcher未运行' };
      }

      return await response.json();
    } catch (error) {
      return { success: false, logs: [], error: error.message };
    }
  }

  async getOpenclawConfig() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/openclaw-config`, {
        method: 'GET',
        mode: 'cors',
        timeout: 10000
      });

      if (!response.ok) {
        return { success: false, error: 'Launcher未运行' };
      }

      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveOpenclawConfig(config) {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/openclaw-config`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config),
        timeout: 10000
      });

      if (!response.ok) {
        return { success: false, error: 'Launcher未运行' };
      }

      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async restartGateway() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/gateway/restart`, {
        method: 'POST',
        mode: 'cors',
        timeout: 30000
      });

      if (!response.ok) {
        return { success: false, error: 'Launcher未运行' };
      }

      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async startGatewayService() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/gateway/start`, {
        method: 'POST',
        mode: 'cors',
        timeout: 30000
      });

      if (!response.ok) {
        return { success: false, error: 'Launcher未运行' };
      }

      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async stopGatewayService() {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/gateway/stop`, {
        method: 'POST',
        mode: 'cors',
        timeout: 30000
      });

      if (!response.ok) {
        return { success: false, error: 'Launcher未运行' };
      }

      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async startGatewayTauri() {
    const { invoke } = await getTauriApi();
    if (invoke) {
      try {
        const result = await invoke('start_gateway');
        return { success: true, message: result };
      } catch (error) {
        return { success: false, error: error.toString() };
      }
    }
    return { success: false, error: 'Tauri API not available' };
  }

  async stopGatewayTauri() {
    const { invoke } = await getTauriApi();
    if (invoke) {
      try {
        const result = await invoke('stop_gateway');
        return { success: true, message: result };
      } catch (error) {
        return { success: false, error: error.toString() };
      }
    }
    return { success: false, error: 'Tauri API not available' };
  }

  async gatewayStatusTauri() {
    const { invoke } = await getTauriApi();
    if (invoke) {
      try {
        const running = await invoke('gateway_status');
        return { success: true, running };
      } catch (error) {
        return { success: false, error: error.toString() };
      }
    }
    return { success: false, error: 'Tauri API not available' };
  }

  async listenGatewayLog(callback) {
    const { listen } = await getTauriApi();
    if (listen) {
      return await listen('gateway-log', (event) => {
        callback(event.payload);
      });
    }
    return null;
  }

  async listenGatewayExit(callback) {
    const { listen } = await getTauriApi();
    if (listen) {
      return await listen('gateway-exit', () => {
        callback();
      });
    }
    return null;
  }

  async getGatewayLogs(since = 0) {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/gateway/logs?since=${since}`, {
        method: 'GET',
        mode: 'cors'
      });
      if (!response.ok) {
        return { success: false, error: 'Failed to fetch logs' };
      }
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getLauncherLogs(lines = 200) {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/launcher/logs?lines=${lines}`, {
        method: 'GET',
        mode: 'cors',
        timeout: 10000
      });

      if (!response.ok) {
        return {
          success: false,
          logs: [],
          total: 0,
          error: 'Launcher未运行'
        };
      }

      const data = await response.json();
      return {
        success: data.success || false,
        logs: data.logs || [],
        total: data.total || 0,
        source: data.source || 'launcher',
        error: data.error || null
      };
    } catch (error) {
      return {
        success: false,
        logs: [],
        total: 0,
        error: error.message
      };
    }
  }

  async getInteractionLogs(lines = 200) {
    try {
      const response = await fetch(`${LAUNCHER_API_BASE}/api/interaction/logs?lines=${lines}`, {
        method: 'GET',
        mode: 'cors',
        timeout: 10000
      });

      const data = await response.json();
      return {
        success: data.success || false,
        logs: data.logs || [],
        total: data.total || 0,
        source: data.source || 'interaction',
        error: data.error || null
      };
    } catch (error) {
      return {
        success: false,
        logs: [],
        total: 0,
        error: error.message
      };
    }
  }
}

const localLauncherService = new LocalLauncherService();
export default localLauncherService;
