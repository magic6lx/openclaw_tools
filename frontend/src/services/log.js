import api from './api';

export const logService = {
  async createLog(data) {
    return api.post('/logs', data);
  },

  async batchCreateLogs(logs) {
    return api.post('/logs/batch', { logs });
  },

  async getLogs(filters = {}) {
    return api.get('/logs', { params: filters });
  },

  async getLogStats(filters = {}) {
    return api.get('/logs/stats', { params: filters });
  },

  async getRecentLogs(limit = 20) {
    return api.get('/logs/recent', { params: { limit } });
  },

  async searchLogs(query, filters = {}) {
    return api.get(`/logs/search/${query}`, { params: filters });
  },

  async deleteLogs(filters = {}) {
    return api.delete('/logs', { params: filters });
  },
};