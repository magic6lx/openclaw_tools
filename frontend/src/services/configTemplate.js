import api from './api';

export const configTemplateService = {
  async createTemplate(data) {
    return api.post('/config-templates', data);
  },

  async getTemplates(filters = {}) {
    return api.get('/config-templates', { params: filters });
  },

  async getTemplate(templateId) {
    return api.get(`/config-templates/${templateId}`);
  },

  async updateTemplate(templateId, data) {
    return api.put(`/config-templates/${templateId}`, data);
  },

  async deleteTemplate(templateId) {
    return api.delete(`/config-templates/${templateId}`);
  },

  async submitForReview(templateId) {
    return api.post(`/config-templates/${templateId}/submit`);
  },

  async reviewTemplate(templateId, data) {
    return api.post(`/config-templates/${templateId}/review`, data);
  },

  async getTemplateVersions(templateId) {
    return api.get(`/config-templates/${templateId}/versions`);
  },

  async getTemplateReviews(templateId) {
    return api.get(`/config-templates/${templateId}/reviews`);
  },
};