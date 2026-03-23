const { ConfigTemplate, UserConfig, User } = require('../models');

class RecommendationService {
  async recommendConfig(userId, environmentInfo) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      const { os_type, os_version, hardware_info, network_info } = environmentInfo;

      const templates = await ConfigTemplate.findAll({
        where: { status: 'approved' }
      });

      const scoredTemplates = templates.map(template => {
        const score = this.calculateScore(template, {
          os_type: os_type || user.os_type,
          os_version: os_version || user.os_version,
          hardware_info: hardware_info || user.hardware_info,
          network_info
        });
        return {
          template,
          score
        };
      });

      scoredTemplates.sort((a, b) => b.score - a.score);

      const topRecommendations = scoredTemplates.slice(0, 5).map(item => ({
        ...item.template.toJSON(),
        recommendation_score: item.score,
        match_reason: this.getMatchReason(item.template, environmentInfo)
      }));

      return {
        recommendations: topRecommendations,
        environment_info: {
          os_type: os_type || user.os_type,
          os_version: os_version || user.os_version,
          hardware_info: hardware_info || user.hardware_info,
          network_info
        }
      };
    } catch (error) {
      throw new Error(`推荐配置失败: ${error.message}`);
    }
  }

  calculateScore(template, environment) {
    let score = 0;
    const templateMetadata = template.metadata || {};

    if (templateMetadata.os_type) {
      if (templateMetadata.os_type === environment.os_type) {
        score += 40;
      } else if (this.isCompatibleOS(templateMetadata.os_type, environment.os_type)) {
        score += 20;
      }
    }

    if (templateMetadata.os_version && environment.os_version) {
      const templateVersion = this.parseVersion(templateMetadata.os_version);
      const userVersion = this.parseVersion(environment.os_version);
      
      if (userVersion.major === templateVersion.major) {
        score += 20;
      } else if (userVersion.major >= templateVersion.major) {
        score += 10;
      }
    }

    if (templateMetadata.hardware_requirements && environment.hardware_info) {
      const hardwareScore = this.evaluateHardwareMatch(
        templateMetadata.hardware_requirements,
        environment.hardware_info
      );
      score += hardwareScore * 0.3;
    }

    if (templateMetadata.network_requirements && environment.network_info) {
      const networkScore = this.evaluateNetworkMatch(
        templateMetadata.network_requirements,
        environment.network_info
      );
      score += networkScore * 0.1;
    }

    return Math.min(score, 100);
  }

  isCompatibleOS(templateOS, userOS) {
    const osCompatibility = {
      'Windows': ['Windows'],
      'macOS': ['macOS', 'Darwin'],
      'Linux': ['Linux']
    };

    const compatibleOS = osCompatibility[templateOS] || [];
    return compatibleOS.includes(userOS);
  }

  parseVersion(versionString) {
    const parts = versionString.split('.').map(Number);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0
    };
  }

  evaluateHardwareMatch(requirements, userHardware) {
    let score = 0;
    const hardware = typeof userHardware === 'string' 
      ? JSON.parse(userHardware) 
      : userHardware;

    if (requirements.cpu && hardware.cpu) {
      if (hardware.cpu.cores >= (requirements.cpu.cores || 2)) {
        score += 15;
      }
      if (hardware.cpu.frequency >= (requirements.cpu.frequency || 2.0)) {
        score += 10;
      }
    }

    if (requirements.memory && hardware.memory) {
      const userMemoryGB = hardware.memory / (1024 * 1024 * 1024);
      if (userMemoryGB >= (requirements.memory || 4)) {
        score += 20;
      }
    }

    if (requirements.storage && hardware.storage) {
      const userStorageGB = hardware.storage / (1024 * 1024 * 1024);
      if (userStorageGB >= (requirements.storage || 10)) {
        score += 10;
      }
    }

    return Math.min(score, 55);
  }

  evaluateNetworkMatch(requirements, networkInfo) {
    let score = 0;

    if (requirements.min_bandwidth && networkInfo.bandwidth) {
      if (networkInfo.bandwidth >= requirements.min_bandwidth) {
        score += 5;
      }
    }

    if (requirements.latency && networkInfo.latency) {
      if (networkInfo.latency <= requirements.latency) {
        score += 5;
      }
    }

    return Math.min(score, 10);
  }

  getMatchReason(template, environment) {
    const reasons = [];
    const templateMetadata = template.metadata || {};

    if (templateMetadata.os_type && templateMetadata.os_type === environment.os_type) {
      reasons.push(`操作系统匹配: ${templateMetadata.os_type}`);
    }

    if (templateMetadata.os_version && environment.os_version) {
      reasons.push(`系统版本兼容: ${templateMetadata.os_version}`);
    }

    if (templateMetadata.hardware_requirements) {
      reasons.push('硬件配置满足要求');
    }

    if (template.category) {
      reasons.push(`分类: ${template.category}`);
    }

    return reasons.length > 0 ? reasons.join(', ') : '通用推荐';
  }

  async getRecommendedTemplates(userId, limit = 10) {
    try {
      const user = await User.findByPk(userId, {
        include: [{ model: UserConfig, as: 'configs' }]
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      const usedTemplateIds = user.configs.map(uc => uc.template_id).filter(id => id);

      const templates = await ConfigTemplate.findAll({
        where: {
          status: 'approved',
          id: { $notIn: usedTemplateIds }
        },
        limit: limit,
        order: [['created_at', 'DESC']]
      });

      const recommendations = templates.map(template => {
        const score = this.calculateScore(template, {
          os_type: user.os_type,
          os_version: user.os_version,
          hardware_info: user.hardware_info
        });

        return {
          ...template.toJSON(),
          recommendation_score: score
        };
      });

      recommendations.sort((a, b) => b.recommendation_score - a.recommendation_score);

      return recommendations;
    } catch (error) {
      throw new Error(`获取推荐模版失败: ${error.message}`);
    }
  }
}

module.exports = new RecommendationService();