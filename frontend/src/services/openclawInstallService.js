const API_BASE_URL = 'http://localhost:3000/api';

class OpenClawInstallService {
  async checkSystem() {
    try {
      const response = await fetch(`${API_BASE_URL}/openclaw-install/check-system`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('检查系统失败:', error);
      throw error;
    }
  }

  async installOpenClaw(upgrade = false) {
    try {
      const response = await fetch(`${API_BASE_URL}/openclaw-install/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ upgrade })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('安装OpenClaw失败:', error);
      throw error;
    }
  }

  async getInstallLogs() {
    try {
      const response = await fetch(`${API_BASE_URL}/openclaw-install/logs`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取安装日志失败:', error);
      throw error;
    }
  }

  async verifyInstallation() {
    try {
      const response = await fetch(`${API_BASE_URL}/openclaw-install/verify`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('验证安装失败:', error);
      throw error;
    }
  }
}

export default new OpenClawInstallService();