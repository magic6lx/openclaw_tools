import api from './api';

const ClientMonitorService = {
  generateDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  },

  getClientSystemInfo() {
    const navigator = window.navigator;
    const screen = window.screen;
    const document = window.document;

    function getBrowserInfo() {
      const ua = navigator.userAgent;
      let browserName = 'Unknown';
      let browserVersion = 'Unknown';

      if (ua.indexOf('Firefox') > -1) {
        browserName = 'Firefox';
        browserVersion = ua.match(/Firefox\/([\d.]+)/)?.[1] || 'Unknown';
      } else if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) {
        browserName = 'Chrome';
        browserVersion = ua.match(/Chrome\/([\d.]+)/)?.[1] || 'Unknown';
      } else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
        browserName = 'Safari';
        browserVersion = ua.match(/Version\/([\d.]+)/)?.[1] || 'Unknown';
      } else if (ua.indexOf('Edg') > -1) {
        browserName = 'Edge';
        browserVersion = ua.match(/Edg\/([\d.]+)/)?.[1] || 'Unknown';
      } else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) {
        browserName = 'Opera';
        browserVersion = ua.match(/(?:Opera|OPR)\/([\d.]+)/)?.[1] || 'Unknown';
      }

      return { browserName, browserVersion };
    }

    function getOSInfo() {
      const ua = navigator.userAgent;
      let osName = 'Unknown';
      let osVersion = 'Unknown';

      if (ua.indexOf('Windows') > -1) {
        osName = 'Windows';
        const match = ua.match(/Windows NT ([\d.]+)/);
        if (match) {
          const ntVersion = match[1];
          const windowsVersions = {
            '10.0': '10/11',
            '6.3': '8.1',
            '6.2': '8',
            '6.1': '7',
            '6.0': 'Vista',
            '5.1': 'XP'
          };
          osVersion = windowsVersions[ntVersion] || ntVersion;
        }
      } else if (ua.indexOf('Mac OS X') > -1) {
        osName = 'macOS';
        osVersion = ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.') || 'Unknown';
      } else if (ua.indexOf('Linux') > -1) {
        osName = 'Linux';
        osVersion = ua.match(/Linux ([\d.]+)/)?.[1] || 'Unknown';
      } else if (ua.indexOf('Android') > -1) {
        osName = 'Android';
        osVersion = ua.match(/Android ([\d.]+)/)?.[1] || 'Unknown';
      } else if (ua.indexOf('iOS') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) {
        osName = 'iOS';
        osVersion = ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, '.') || 'Unknown';
      }

      return { osName, osVersion };
    }

    function getDeviceType() {
      const ua = navigator.userAgent;
      if (/tablet|ipad|playbook|silk/i.test(ua)) {
        return 'tablet';
      }
      if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
        return 'mobile';
      }
      return 'desktop';
    }

    function getConnectionType() {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      return connection?.effectiveType || connection?.type || 'Unknown';
    }

    const browserInfo = getBrowserInfo();
    const osInfo = getOSInfo();

    return {
      deviceId: this.generateDeviceId(),
      platform: navigator.platform || 'Unknown',
      userAgent: navigator.userAgent,
      browserName: browserInfo.browserName,
      browserVersion: browserInfo.browserVersion,
      osName: osInfo.osName,
      osVersion: osInfo.osVersion,
      deviceType: getDeviceType(),
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth || 'Unknown',
      hardwareConcurrency: navigator.hardwareConcurrency || 'Unknown',
      deviceMemory: navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'Unknown',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack || 'Unknown',
      javaEnabled: navigator.javaEnabled?.() || false,
      plugins: Array.from(navigator.plugins || []).map(p => p.name),
      connectionType: getConnectionType(),
      referrer: document.referrer || 'Direct',
      currentUrl: window.location.href
    };
  },

  async submitClientInfo() {
    try {
      const clientData = this.getClientSystemInfo();
      const response = await api.post('/client-monitor/submit', clientData);
      return response.data;
    } catch (error) {
      console.error('提交客户端信息失败:', error);
      throw error;
    }
  },

  async getClientList(params = {}) {
    try {
      const response = await api.get('/client-monitor/list', { params });
      return response.data;
    } catch (error) {
      console.error('获取客户端列表失败:', error);
      throw error;
    }
  },

  async getClientDetail(deviceId) {
    try {
      const response = await api.get(`/client-monitor/detail/${deviceId}`);
      return response.data;
    } catch (error) {
      console.error('获取客户端详情失败:', error);
      throw error;
    }
  },

  heartbeatTimer: null,

  startHeartbeat(intervalMs = 30000) {
    this.submitClientInfo();

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.submitClientInfo();
    }, intervalMs);
  },

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
};

export default ClientMonitorService;