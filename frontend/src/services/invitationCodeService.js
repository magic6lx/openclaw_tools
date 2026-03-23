const API_BASE_URL = 'http://localhost:3000/api';

class InvitationCodeService {
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

  async getAllCodes(status = 'all') {
    try {
      const url = status === 'all' 
        ? `${API_BASE_URL}/invitation-codes`
        : `${API_BASE_URL}/invitation-codes?status=${status}`;
      
      const response = await fetch(url, {
        headers: this.getHeaders()
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取邀请码列表失败:', error);
      throw error;
    }
  }

  async generateCode(maxDevices = 3, tokensLimit = 50000, expiresInMonths = 3, requestsLimit = 10) {
    try {
      const response = await fetch(`${API_BASE_URL}/invitation-codes/generate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ 
          max_devices: maxDevices,
          tokens_limit: tokensLimit,
          expires_in_months: expiresInMonths,
          requests_limit: requestsLimit
        })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('生成邀请码失败:', error);
      throw error;
    }
  }

  async validateCode(code) {
    try {
      const response = await fetch(`${API_BASE_URL}/invitation-codes/${code}/validate`, {
        headers: this.getHeaders()
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('验证邀请码失败:', error);
      throw error;
    }
  }

  async bindDevice(code, deviceId, deviceInfo) {
    try {
      const response = await fetch(`${API_BASE_URL}/invitation-codes/${code}/bind`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ device_id: deviceId, device_info: deviceInfo })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('绑定设备失败:', error);
      throw error;
    }
  }

  async unbindDevice(userId) {
    try {
      const response = await fetch(`${API_BASE_URL}/invitation-codes/devices/${userId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('解绑设备失败:', error);
      throw error;
    }
  }

  async disableCode(code) {
    try {
      const response = await fetch(`${API_BASE_URL}/invitation-codes/${code}/disable`, {
        method: 'PUT',
        headers: this.getHeaders()
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('禁用邀请码失败:', error);
      throw error;
    }
  }

  async enableCode(code) {
    try {
      const response = await fetch(`${API_BASE_URL}/invitation-codes/${code}/enable`, {
        method: 'PUT',
        headers: this.getHeaders()
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('启用邀请码失败:', error);
      throw error;
    }
  }

  async getDevices(code) {
    try {
      const response = await fetch(`${API_BASE_URL}/invitation-codes/${code}/devices`, {
        headers: this.getHeaders()
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取设备列表失败:', error);
      throw error;
    }
  }

  async getDeviceStatus(userId) {
    try {
      const response = await fetch(`${API_BASE_URL}/invitation-codes/devices/${userId}/status`, {
        headers: this.getHeaders()
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取设备状态失败:', error);
      throw error;
    }
  }

  async updateTokensLimit(code, tokensLimit) {
    try {
      const response = await fetch(`${API_BASE_URL}/invitation-codes/${code}/tokens`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ tokens_limit: tokensLimit })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('更新token限制失败:', error);
      throw error;
    }
  }

  async updateExpiryDate(code, expiresInMonths) {
    try {
      const response = await fetch(`${API_BASE_URL}/invitation-codes/${code}/expiry`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ expires_in_months: expiresInMonths })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('更新过期时间失败:', error);
      throw error;
    }
  }

  async consumeTokens(code, tokens) {
    try {
      const response = await fetch(`${API_BASE_URL}/invitation-codes/${code}/consume`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ tokens })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('消耗token失败:', error);
      throw error;
    }
  }

  async getConfigByCode(code) {
    try {
      const response = await fetch(`${API_BASE_URL}/invitation-codes/${code}/config`, {
        headers: this.getHeaders()
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取邀请码配置失败:', error);
      throw error;
    }
  }
}

export default new InvitationCodeService();