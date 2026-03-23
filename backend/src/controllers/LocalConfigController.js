const localConfigService = require('../services/LocalConfigService');
const configTemplateService = require('../services/ConfigTemplateService');
const logService = require('../services/LogService');

class LocalConfigController {
  async detectDirectories(req, res) {
    try {
      console.log('=== Debug Info ===');
      console.log('USERPROFILE:', process.env.USERPROFILE);
      console.log('USERNAME:', process.env.USERNAME);
      console.log('HOME:', process.env.HOME);
      console.log('OPENCLAW_HOME:', process.env.OPENCLAW_HOME);
      
      const testPath = 'C:\\Users\\Acer\\.openclaw';
      console.log('Testing direct path:', testPath);
      try {
        const fs = require('fs').promises;
        const stat = await fs.stat(testPath);
        console.log('Directory exists:', stat.isDirectory());
        if (stat.isDirectory()) {
          const files = await fs.readdir(testPath);
          console.log('Files in directory:', files);
          console.log('Has openclaw.json:', files.includes('openclaw.json'));
        }
      } catch (error) {
        console.log('Error accessing directory:', error.message);
      }
      console.log('=== End Debug Info ===');
      
      const openclawDir = await localConfigService.detectOpenClawDirectory();
      const workspaceDir = await localConfigService.detectWorkspaceDirectory();
      const systemInfo = await localConfigService.getSystemInfo();

      res.json({
        success: true,
        data: {
          openclaw_directory: openclawDir,
          workspace_directory: workspaceDir,
          system_info: systemInfo
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async importFromDirectory(req, res) {
    try {
      const { directoryPath, openClawConfigDir, workspaceDir } = req.body;
      const userId = req.user?.userId || 1;

      // 记录开始导入的日志
      await logService.createLog(userId, {
        operation_stage: 'configuration',
        level: 'info',
        content: `开始导入配置，目录: ${directoryPath || openClawConfigDir || workspaceDir}`,
        metadata: {
          directoryPath,
          openClawConfigDir,
          workspaceDir
        }
      });

      if (openClawConfigDir || workspaceDir) {
        const result = await localConfigService.importFromBothDirectories(openClawConfigDir, workspaceDir);

        if (!result.success) {
          await logService.createLog(userId, {
            operation_stage: 'configuration',
            level: 'error',
            content: `配置导入失败: ${result.error}`,
            metadata: { error: result.error }
          });
          return res.status(400).json({
            success: false,
            message: result.error
          });
        }

        // 记录导入成功的日志
        await logService.createLog(userId, {
          operation_stage: 'configuration',
          level: 'info',
          content: `配置导入成功，找到 ${result.configs.length} 个配置文件`,
          metadata: {
            configCount: result.configs.length,
            configs: result.configs.map(c => ({
              fileName: c.fileName,
              directoryType: c.directoryType
            }))
          }
        });

        res.json({
          success: true,
          data: result
        });
      } else if (directoryPath) {
        const result = await localConfigService.importFromLocalDirectory(directoryPath);

        if (!result.success) {
          await logService.createLog(userId, {
            operation_stage: 'configuration',
            level: 'error',
            content: `配置导入失败: ${result.error}`,
            metadata: { error: result.error }
          });
          return res.status(400).json({
            success: false,
            message: result.error
          });
        }

        // 记录导入成功的日志
        await logService.createLog(userId, {
          operation_stage: 'configuration',
          level: 'info',
          content: `配置导入成功，找到 ${result.configs.length} 个配置文件`,
          metadata: {
            configCount: result.configs.length,
            configs: result.configs.map(c => ({
              fileName: c.fileName,
              directoryType: c.directoryType
            }))
          }
        });

        res.json({
          success: true,
          data: result
        });
      } else {
        await logService.createLog(userId, {
          operation_stage: 'configuration',
          level: 'warn',
          content: '配置导入失败：目录路径不能为空',
          metadata: {}
        });
        return res.status(400).json({
          success: false,
          message: '目录路径不能为空'
        });
      }
    } catch (error) {
      const userId = req.user?.userId || 1;
      await logService.createLog(userId, {
        operation_stage: 'configuration',
        level: 'error',
        content: `配置导入异常: ${error.message}`,
        metadata: { error: error.message, stack: error.stack }
      });
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async createTemplate(req, res) {
    try {
      const userId = req.user?.userId || 1;
      const { configData, templateInfo } = req.body;

      if (!configData || !templateInfo || !templateInfo.name) {
        return res.status(400).json({
          success: false,
          message: '配置数据和模版信息不能为空'
        });
      }

      const configsArray = Array.isArray(configData) ? configData : [configData];
      
      const template = await localConfigService.createTemplateFromLocalConfigs(
        configsArray,
        { ...templateInfo, userId }
      );

      const validations = await Promise.all(
        configsArray.map(config => localConfigService.validateConfigStructure(config.config, config.fileName))
      );
      
      const hasErrors = validations.some(v => !v.valid);
      const allErrors = validations.flatMap(v => v.errors || []);
      const allWarnings = validations.flatMap(v => v.warnings || []);

      if (hasErrors) {
        return res.status(400).json({
          success: false,
          message: '配置验证失败',
          errors: allErrors,
          warnings: allWarnings
        });
      }

      const createdTemplate = await configTemplateService.createTemplate(userId, template);

      res.status(201).json({
        success: true,
        data: createdTemplate,
        warnings: allWarnings
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async validateConfig(req, res) {
    try {
      const { config, fileName, filePath } = req.body;

      if (!config) {
        return res.status(400).json({
          success: false,
          message: '配置不能为空'
        });
      }

      const validation = await localConfigService.validateConfigStructure(config, fileName, filePath);

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getSystemInfo(req, res) {
    try {
      const systemInfo = await localConfigService.getSystemInfo();

      res.json({
        success: true,
        data: systemInfo
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async previewConfig(req, res) {
    try {
      const { directoryPath, openClawConfigDir, workspaceDir } = req.body;

      console.log(`[DEBUG] previewConfig - 接收到的参数:`, {
        directoryPath,
        openClawConfigDir,
        workspaceDir
      });

      if (!directoryPath && !openClawConfigDir && !workspaceDir) {
        return res.status(400).json({
          success: false,
          message: '目录路径不能为空'
        });
      }

      let result;
      
      if (openClawConfigDir || workspaceDir) {
        console.log(`[DEBUG] previewConfig - 调用importFromBothDirectories`);
        result = await localConfigService.importFromBothDirectories(openClawConfigDir, workspaceDir);
      } else if (directoryPath) {
        console.log(`[DEBUG] previewConfig - 调用importFromLocalDirectory`);
        result = await localConfigService.importFromLocalDirectory(directoryPath);
        if (!result.success) {
          return res.status(400).json({
            success: false,
            message: result.error
          });
        }
        
        console.log('[DEBUG] previewConfig - 原始result:', JSON.stringify(result, null, 2));
        console.log('[DEBUG] previewConfig - result.configs数量:', result.configs.length);
        console.log('[DEBUG] previewConfig - result.configs:', result.configs);
        
        // 根据directoryType对配置文件进行分组
        const groupedConfigs = {};
        
        result.configs.forEach(config => {
          const directoryType = config.directoryType || 'openclaw_config';
          console.log('[DEBUG] previewConfig - 处理config:', config.fileName, 'directoryType:', directoryType);
          
          if (!groupedConfigs[directoryType]) {
            groupedConfigs[directoryType] = {
              directory: result.directory,
              directoryType: directoryType,
              files: []
            };
          }
          
          groupedConfigs[directoryType].files.push(config);
        });
        
        console.log('[DEBUG] previewConfig - 分组后的groupedConfigs:', JSON.stringify(groupedConfigs, null, 2));
        
        // 将分组后的配置转换为数组
        result = {
          success: true,
          configs: Object.values(groupedConfigs)
        };
        
        console.log('[DEBUG] previewConfig - 最终result:', JSON.stringify(result, null, 2));
      }

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: {
          configs: result.configs
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  getConfigPreview(config) {
    const preview = {
      meta: config.meta ? {
        lastTouchedVersion: config.meta.lastTouchedVersion,
        lastTouchedAt: config.meta.lastTouchedAt
      } : null,
      hasLogging: !!config.logging,
      hasBrowser: !!config.browser,
      hasAuth: !!config.auth,
      hasModels: !!config.models,
      hasAgents: !!config.agents,
      hasTools: !!config.tools,
      hasBindings: !!config.bindings && config.bindings.length > 0,
      hasChannels: !!config.channels,
      hasGateway: !!config.gateway,
      hasSkills: !!config.skills,
      modelProviders: config.models && config.models.providers ? 
        Object.keys(config.models.providers) : [],
      enabledChannels: config.channels ? 
        Object.keys(config.channels).filter(ch => config.channels[ch].enabled) : [],
      enabledSkills: config.skills && config.skills.entries ? 
        Object.keys(config.skills.entries).filter(sk => config.skills.entries[sk].enabled) : []
    };

    return preview;
  }
}

module.exports = new LocalConfigController();