const LAUNCHER_API_BASE = 'http://127.0.0.1:18790';

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
        gatewayRunning: data.gatewayRunning || false,
        gatewayPort: data.gatewayPort || null,
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
}

const localLauncherService = new LocalLauncherService();
export default localLauncherService;
