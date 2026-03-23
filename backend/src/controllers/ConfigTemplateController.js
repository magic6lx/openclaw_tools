const configTemplateService = require('../services/ConfigTemplateService');
const { authMiddleware } = require('../middleware/auth');

class ConfigTemplateController {
  async create(req, res) {
    try {
      const userId = req.user.userId;
      const template = await configTemplateService.createTemplate(userId, req.body);
      res.status(201).json({
        success: true,
        data: template
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async update(req, res) {
    try {
      const { templateId } = req.params;
      const userId = req.user.userId;
      const template = await configTemplateService.updateTemplate(templateId, userId, req.body);
      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async delete(req, res) {
    try {
      const { templateId } = req.params;
      const userId = req.user.userId;
      const result = await configTemplateService.deleteTemplate(templateId, userId);
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

  async getOne(req, res) {
    try {
      const { templateId } = req.params;
      const template = await configTemplateService.getTemplate(templateId);
      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  async getList(req, res) {
    try {
      const filters = req.query;
      const result = await configTemplateService.getTemplates(filters);
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

  async submitReview(req, res) {
    try {
      const { templateId } = req.params;
      const userId = req.user.userId;
      const template = await configTemplateService.submitForReview(templateId, userId);
      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async review(req, res) {
    try {
      const { templateId } = req.params;
      const reviewerId = req.user.userId;
      const template = await configTemplateService.reviewTemplate(templateId, reviewerId, req.body);
      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getVersions(req, res) {
    try {
      const { templateId } = req.params;
      const versions = await configTemplateService.getTemplateVersions(templateId);
      res.json({
        success: true,
        data: versions
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getReviews(req, res) {
    try {
      const { templateId } = req.params;
      const reviews = await configTemplateService.getTemplateReviews(templateId);
      res.json({
        success: true,
        data: reviews
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new ConfigTemplateController();