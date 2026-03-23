import api from './api';

export const userConfigService = {
  async applyTemplate(templateId, customConfig = {}) {
    return api.post(`/user-configs/apply/${templateId}`, { custom_config: customConfig });
  },

  async getUserConfigs() {
    return api.get('/user-configs');
  },

  async getActiveConfig() {
    return api.get('/user-configs/active');
  },

  async updateConfig(configId, data) {
    return api.put(`/user-configs/${configId}`, data);
  },

  async activateConfig(configId) {
    return api.put(`/user-configs/${configId}/activate`);
  },

  async deleteConfig(configId) {
    return api.delete(`/user-configs/${configId}`);
  },

  async exportConfig(configId) {
    return api.get(`/user-configs/${configId}/export`);
  },

  async importConfig(data) {
    return api.post('/user-configs/import', data);
  },
};