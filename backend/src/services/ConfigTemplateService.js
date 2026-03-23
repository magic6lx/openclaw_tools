const { ConfigTemplate, User, TemplateReview } = require('../models');

class ConfigTemplateService {
  async createTemplate(userId, templateData) {
    try {
      const template = await ConfigTemplate.create({
        ...templateData,
        author_id: userId,
        status: 'draft',
        version: '1.0'
      });
      return template;
    } catch (error) {
      throw new Error(`创建配置模版失败: ${error.message}`);
    }
  }

  async updateTemplate(templateId, userId, updateData) {
    try {
      const template = await ConfigTemplate.findByPk(templateId);
      
      if (!template) {
        throw new Error('配置模版不存在');
      }

      if (template.author_id !== userId && template.status !== 'draft') {
        throw new Error('无权限修改此模版');
      }

      if (template.status === 'approved') {
        const newTemplate = await ConfigTemplate.create({
          ...template.toJSON(),
          ...updateData,
          id: undefined,
          parent_id: template.id,
          author_id: userId,
          status: 'draft',
          version: this.incrementVersion(template.version)
        });
        return newTemplate;
      } else {
        await template.update(updateData);
        return template;
      }
    } catch (error) {
      throw new Error(`更新配置模版失败: ${error.message}`);
    }
  }

  async deleteTemplate(templateId, userId) {
    try {
      const template = await ConfigTemplate.findByPk(templateId);
      
      if (!template) {
        throw new Error('配置模版不存在');
      }

      if (template.author_id !== userId) {
        throw new Error('无权限删除此模版');
      }

      if (template.status === 'approved') {
        throw new Error('已审核的模版不能删除');
      }

      await template.destroy();
      return { message: '删除成功' };
    } catch (error) {
      throw new Error(`删除配置模版失败: ${error.message}`);
    }
  }

  async getTemplate(templateId) {
    try {
      const template = await ConfigTemplate.findByPk(templateId, {
        include: [
          { model: User, as: 'author', attributes: ['id', 'device_name'] },
          { model: User, as: 'reviewer', attributes: ['id', 'device_name'] }
        ]
      });

      if (!template) {
        throw new Error('配置模版不存在');
      }

      return template;
    } catch (error) {
      throw new Error(`获取配置模版失败: ${error.message}`);
    }
  }

  async getTemplates(filters = {}) {
    try {
      const { status, category, author_id, page = 1, limit = 20 } = filters;
      
      const where = {};
      if (status) where.status = status;
      if (category) where.category = category;
      if (author_id) where.author_id = author_id;

      const { count, rows } = await ConfigTemplate.findAndCountAll({
        where,
        include: [
          { model: User, as: 'author', attributes: ['id', 'device_name'] }
        ],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        order: [['created_at', 'DESC']]
      });

      return {
        templates: rows,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      };
    } catch (error) {
      throw new Error(`获取配置模版列表失败: ${error.message}`);
    }
  }

  async submitForReview(templateId, userId) {
    try {
      const template = await ConfigTemplate.findByPk(templateId);
      
      if (!template) {
        throw new Error('配置模版不存在');
      }

      if (template.author_id !== userId) {
        throw new Error('无权限提交此模版');
      }

      if (template.status !== 'draft') {
        throw new Error('只有草稿状态的模版可以提交审核');
      }

      await template.update({ status: 'pending' });
      return template;
    } catch (error) {
      throw new Error(`提交审核失败: ${error.message}`);
    }
  }

  async reviewTemplate(templateId, reviewerId, reviewData) {
    try {
      const template = await ConfigTemplate.findByPk(templateId);
      
      if (!template) {
        throw new Error('配置模版不存在');
      }

      if (template.status !== 'pending') {
        throw new Error('只有待审核状态的模版可以审核');
      }

      const { status, comment } = reviewData;

      await TemplateReview.create({
        template_id: templateId,
        reviewer_id: reviewerId,
        status,
        comment
      });

      await template.update({
        status: status === 'approved' ? 'approved' : 'rejected',
        reviewer_id: reviewerId
      });

      return template;
    } catch (error) {
      throw new Error(`审核模版失败: ${error.message}`);
    }
  }

  async getTemplateVersions(templateId) {
    try {
      const template = await ConfigTemplate.findByPk(templateId);
      
      if (!template) {
        throw new Error('配置模版不存在');
      }

      const versions = await ConfigTemplate.findAll({
        where: {
          $or: [
            { id: templateId },
            { parent_id: templateId }
          ]
        },
        order: [['created_at', 'ASC']]
      });

      return versions;
    } catch (error) {
      throw new Error(`获取模版版本失败: ${error.message}`);
    }
  }

  async getTemplateReviews(templateId) {
    try {
      const reviews = await TemplateReview.findAll({
        where: { template_id: templateId },
        include: [
          { model: User, as: 'reviewer', attributes: ['id', 'device_name'] }
        ],
        order: [['created_at', 'DESC']]
      });

      return reviews;
    } catch (error) {
      throw new Error(`获取审核记录失败: ${error.message}`);
    }
  }

  incrementVersion(version) {
    const parts = version.split('.');
    const major = parseInt(parts[0]) || 1;
    const minor = parseInt(parts[1]) || 0;
    return `${major}.${minor + 1}`;
  }
}

module.exports = new ConfigTemplateService();