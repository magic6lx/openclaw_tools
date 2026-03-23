import api from './api';

class RuntimeMonitorService {
  async getSystemStatus() {
    try {
      const token = localStorage.getItem('token');
      console.log('运行监控 - Token存在:', !!token);
      const response = await api.get('/runtime-monitor/system-status');
      console.log('运行监控 - 响应:', response);
      return response;
    } catch (error) {
      console.error('获取系统状态失败:', error);
      throw error;
    }
  }

  async restartOpenClaw(action) {
    try {
      const response = await api.post('/runtime-monitor/restart-openclaw', { action });
      return response;
    } catch (error) {
      console.error('操作OpenClaw失败:', error);
      throw error;
    }
  }

  async getOpenClawOperationProgress() {
    try {
      const response = await api.get('/runtime-monitor/openclaw-operation-progress');
      return response;
    } catch (error) {
      console.error('获取OpenClaw操作进度失败:', error);
      throw error;
    }
  }

  async getOpenClawLogs(limit = 50) {
    try {
      const response = await api.get('/runtime-monitor/openclaw-logs', { params: { limit } });
      return response;
    } catch (error) {
      console.error('获取OpenClaw日志失败:', error);
      throw error;
    }
  }

  async getNodeProcessesDetails() {
    try {
      const response = await api.get('/runtime-monitor/node-processes-details');
      return response;
    } catch (error) {
      console.error('获取Node.js进程详情失败:', error);
      throw error;
    }
  }

  async getProcessLogs(pid) {
    try {
      const params = pid ? { pid } : {};
      const response = await api.get('/runtime-monitor/process-logs', { params });
      return response;
    } catch (error) {
      console.error('获取进程日志失败:', error);
      throw error;
    }
  }

  async getProcessDetails(pid) {
    try {
      const response = await api.get(`/runtime-monitor/process-details/${pid}`);
      return response;
    } catch (error) {
      console.error('获取进程详情失败:', error);
      throw error;
    }
  }
}

export default new RuntimeMonitorService();