const { UserConfig, ConfigTemplate, User } = require('../models');
const path = require('path');

class UserConfigService {
  // 路径占位符映射
  getPathPlaceholders() {
    return {
      '{OPENCLAW_HOME}': process.env.OPENCLAW_HOME || path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw'),
      '{HOME}': process.env.HOME || process.env.USERPROFILE,
      '{WORKSPACE}': process.cwd(),
      '{TEMP}': process.env.TEMP || process.env.TMP || '/tmp',
      '{APPDATA}': path.join(process.env.HOME || process.env.USERPROFILE, 'AppData', 'Roaming'),
      '{LOCALAPPDATA}': path.join(process.env.HOME || process.env.USERPROFILE, 'AppData', 'Local'),
      '{DOCUMENTS}': path.join(process.env.HOME || process.env.USERPROFILE, 'Documents'),
      '{DESKTOP}': path.join(process.env.HOME || process.env.USERPROFILE, 'Desktop'),
      '{DOWNLOADS}': path.join(process.env.HOME || process.env.USERPROFILE, 'Downloads')
    };
  }

  // 将占位符路径转换为绝对路径
  convertToAbsolutePath(portablePath) {
    if (!portablePath) return portablePath;
    
    if (typeof portablePath !== 'string') return portablePath;
    
    const placeholders = this.getPathPlaceholders();
    
    // 检查是否包含占位符
    for (const [placeholder, realPath] of Object.entries(placeholders)) {
      if (portablePath.startsWith(placeholder)) {
        const relativePart = portablePath.substring(placeholder.length).replace(/^[\\/]/, '');
        return relativePart ? path.join(realPath, relativePart) : realPath;
      }
    }
    
    // 如果没有占位符，尝试相对于当前工作目录
    if (!path.isAbsolute(portablePath)) {
      return path.join(process.cwd(), portablePath);
    }
    
    return portablePath;
  }

  // 清理配置中的路径，将占位符路径转换为绝对路径
  sanitizeConfigPaths(config) {
    if (!config) return config;
    
    if (typeof config === 'string') {
      return this.convertToAbsolutePath(config);
    }
    
    if (Array.isArray(config)) {
      return config.map(item => this.sanitizeConfigPaths(item));
    }
    
    if (typeof config === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(config)) {
        // 检查键名是否包含路径相关的词
        const isPathKey = /path|directory|folder|location|file|log|workspace|home/i.test(key);
        
        if (isPathKey && typeof value === 'string') {
          sanitized[key] = this.convertToAbsolutePath(value);
        } else {
          sanitized[key] = this.sanitizeConfigPaths(value);
        }
      }
      return sanitized;
    }
    
    return config;
  }

  async applyTemplate(userId, templateId, customConfig = {}) {
    try {
      const template = await ConfigTemplate.findByPk(templateId);
      
      if (!template) {
        throw new Error('配置模版不存在');
      }

      if (template.status !== 'approved') {
        throw new Error('只能应用已审核的模版');
      }

      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      await UserConfig.update(
        { is_active: false },
        { where: { user_id: userId } }
      );

      // 将占位符路径转换为绝对路径
      const sanitizedTemplateConfig = this.sanitizeConfigPaths(template.config_content);
      const sanitizedCustomConfig = this.sanitizeConfigPaths(customConfig);

      const mergedConfig = this.mergeConfigs(sanitizedTemplateConfig, sanitizedCustomConfig);

      const userConfig = await UserConfig.create({
        user_id: userId,
        template_id: templateId,
        config_content: mergedConfig,
        version: template.version,
        is_active: true
      });

      return userConfig;
    } catch (error) {
      throw new Error(`应用模版失败: ${error.message}`);
    }
  }

  async updateConfig(userId, configId, updateData) {
    try {
      const userConfig = await UserConfig.findOne({
        where: { id: configId, user_id: userId }
      });

      if (!userConfig) {
        throw new Error('配置不存在');
      }

      const mergedConfig = this.mergeConfigs(userConfig.config_content, updateData);

      await userConfig.update({
        config_content: mergedConfig
      });

      return userConfig;
    } catch (error) {
      throw new Error(`更新配置失败: ${error.message}`);
    }
  }

  async getUserConfigs(userId) {
    try {
      const configs = await UserConfig.findAll({
        where: { user_id: userId },
        include: [
          { model: ConfigTemplate, as: 'template' }
        ],
        order: [['created_at', 'DESC']]
      });

      return configs;
    } catch (error) {
      throw new Error(`获取用户配置失败: ${error.message}`);
    }
  }

  async getActiveConfig(userId) {
    try {
      const activeConfig = await UserConfig.findOne({
        where: { user_id: userId, is_active: true },
        include: [
          { model: ConfigTemplate, as: 'template' }
        ]
      });

      return activeConfig;
    } catch (error) {
      throw new Error(`获取当前配置失败: ${error.message}`);
    }
  }

  async activateConfig(userId, configId) {
    try {
      const userConfig = await UserConfig.findOne({
        where: { id: configId, user_id: userId }
      });

      if (!userConfig) {
        throw new Error('配置不存在');
      }

      await UserConfig.update(
        { is_active: false },
        { where: { user_id: userId } }
      );

      await userConfig.update({ is_active: true });

      return userConfig;
    } catch (error) {
      throw new Error(`激活配置失败: ${error.message}`);
    }
  }

  async deleteConfig(userId, configId) {
    try {
      const userConfig = await UserConfig.findOne({
        where: { id: configId, user_id: userId }
      });

      if (!userConfig) {
        throw new Error('配置不存在');
      }

      if (userConfig.is_active) {
        throw new Error('不能删除当前激活的配置');
      }

      await userConfig.destroy();
      return { message: '删除成功' };
    } catch (error) {
      throw new Error(`删除配置失败: ${error.message}`);
    }
  }

  async exportConfig(userId, configId) {
    try {
      const userConfig = await UserConfig.findOne({
        where: { id: configId, user_id: userId },
        include: [
          { model: ConfigTemplate, as: 'template' }
        ]
      });

      if (!userConfig) {
        throw new Error('配置不存在');
      }

      return {
        config: userConfig.config_content,
        template_name: userConfig.template ? userConfig.template.name : 'Custom',
        version: userConfig.version,
        exported_at: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`导出配置失败: ${error.message}`);
    }
  }

  async importConfig(userId, configData) {
    try {
      const { config_content, template_name, version } = configData;

      await UserConfig.update(
        { is_active: false },
        { where: { user_id: userId } }
      );

      const userConfig = await UserConfig.create({
        user_id: userId,
        template_id: null,
        config_content: config_content,
        version: version || '1.0',
        is_active: true
      });

      return userConfig;
    } catch (error) {
      throw new Error(`导入配置失败: ${error.message}`);
    }
  }

  mergeConfigs(baseConfig, customConfig) {
    const merged = { ...baseConfig };
    
    for (const key in customConfig) {
      if (typeof customConfig[key] === 'object' && !Array.isArray(customConfig[key])) {
        merged[key] = this.mergeConfigs(merged[key] || {}, customConfig[key]);
      } else {
        merged[key] = customConfig[key];
      }
    }
    
    return merged;
  }
}

module.exports = new UserConfigService();