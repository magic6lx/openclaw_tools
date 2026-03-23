const API_BASE_URL = 'http://localhost:3000/api';

class LocalConfigService {
  async getAuthToken() {
    return localStorage.getItem('token');
  }

  getHeaders() {
    const token = this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  getHeadersWithoutAuth() {
    return {
      'Content-Type': 'application/json'
    };
  }

  async detectDirectories() {
    try {
      const response = await fetch(`${API_BASE_URL}/local-config/detect-directories`, {
        headers: this.getHeadersWithoutAuth()
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('检测目录失败:', error);
      throw error;
    }
  }

  async importFromDirectory(directoryPath) {
    try {
      const response = await fetch(`${API_BASE_URL}/local-config/import-from-directory`, {
        method: 'POST',
        headers: this.getHeadersWithoutAuth(),
        body: JSON.stringify({ directoryPath })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('从目录导入配置失败:', error);
      throw error;
    }
  }

  async previewConfig(directoryPath, openClawConfigDir, workspaceDir) {
    try {
      const response = await fetch(`${API_BASE_URL}/local-config/preview-config`, {
        method: 'POST',
        headers: this.getHeadersWithoutAuth(),
        body: JSON.stringify({ directoryPath, openClawConfigDir, workspaceDir })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('预览配置失败:', error);
      throw error;
    }
  }

  async createTemplate(configData, templateInfo) {
    try {
      const response = await fetch(`${API_BASE_URL}/local-config/create-template`, {
        method: 'POST',
        headers: this.getHeadersWithoutAuth(),
        body: JSON.stringify({ configData, templateInfo })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('创建模版失败:', error);
      throw error;
    }
  }

  async validateConfig(config, fileName, filePath) {
    try {
      const response = await fetch(`${API_BASE_URL}/local-config/validate-config`, {
        method: 'POST',
        headers: this.getHeadersWithoutAuth(),
        body: JSON.stringify({ config, fileName, filePath })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('验证配置失败:', error);
      throw error;
    }
  }

  async getSystemInfo() {
    try {
      const response = await fetch(`${API_BASE_URL}/local-config/system-info`, {
        headers: this.getHeadersWithoutAuth()
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取系统信息失败:', error);
      throw error;
    }
  }
}

export default new LocalConfigService();