const recommendationService = require('../services/RecommendationService');
const { authMiddleware } = require('../middleware/auth');

class RecommendationController {
  async getRecommendations(req, res) {
    try {
      const userId = req.user.userId;
      const environmentInfo = req.body;
      const result = await recommendationService.recommendConfig(userId, environmentInfo);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getRecommendedTemplates(req, res) {
    try {
      const userId = req.user.userId;
      const { limit } = req.query;
      const templates = await recommendationService.getRecommendedTemplates(userId, limit);
      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new RecommendationController();