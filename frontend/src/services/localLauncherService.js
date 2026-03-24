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
