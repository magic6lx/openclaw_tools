import api from './api';

export const recommendationService = {
  async getRecommendations(environmentInfo) {
    return api.post('/recommendations', environmentInfo);
  },

  async getRecommendedTemplates(limit = 10) {
    return api.get('/recommendations/templates', { params: { limit } });
  },
};