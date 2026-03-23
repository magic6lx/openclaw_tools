const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const logService = require('./LogService');
const configValidationService = require('./ConfigValidationService');

class LocalConfigService {
  // 路径占位符映射
  getPathPlaceholders() {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const openclawHome = process.env.OPENCLAW_HOME || path.join(homeDir, '.openclaw');
    
    // 尝试检测workspace路径
    let workspacePath = process.cwd();
    const possibleWorkspacePaths = [
      'D:\\Tu工作同步\\My工作同步\\openclaw_workspace',
      path.join(homeDir, 'workspace'),
      path.join(homeDir, 'Documents', 'workspace'),
      path.join(homeDir, 'Projects', 'workspace'),
      path.join('D:', 'workspace'),
      path.join('D:', 'Projects', 'workspace')
    ];
    
    // 检查可能的workspace路径是否存在
    for (const possiblePath of possibleWorkspacePaths) {
      try {
        if (fsSync.existsSync(possiblePath)) {
          workspacePath = possiblePath;
          console.log(`[DEBUG] 检测到workspace路径: ${workspacePath}`);
          break;
        }
      } catch (error) {
        // 忽略错误
        console.log(`[DEBUG] 检查路径失败: ${possiblePath}, 错误: ${error.message}`);
      }
    }
    
    const placeholders = {
      '{OPENCLAW_HOME}': openclawHome,
      '{HOME}': homeDir,
      '{WORKSPACE}': workspacePath,
      '{TEMP}': process.env.TEMP || process.env.TMP || '/tmp',
      '{APPDATA}': path.join(homeDir, 'AppData', 'Roaming'),
      '{LOCALAPPDATA}': path.join(homeDir, 'AppData', 'Local'),
      '{DOCUMENTS}': path.join(homeDir, 'Documents'),
      '{DESKTOP}': path.join(homeDir, 'Desktop'),
      '{DOWNLOADS}': path.join(homeDir, 'Downloads')
    };
    
    console.log(`[DEBUG] 路径占位符配置:`, JSON.stringify(placeholders, null, 2));
    
    return placeholders;
  }

  // 判断字符串是否看起来像路径
  looksLikePath(str) {
    if (!str || typeof str !== 'string') return false;
    
    // 检查是否包含路径分隔符
    if (!str.includes('\\') && !str.includes('/')) return false;
    
    // 检查是否包含盘符（Windows路径）
    if (/^[A-Za-z]:/.test(str)) return true;
    
    // 检查是否包含常见的路径模式
    if (/^(\/|~|[A-Za-z]:|\.\/|\.\\)/.test(str)) return true;
    
    // 检查是否包含常见的路径关键词
    if (/path|directory|folder|file|log|workspace|home|user/i.test(str)) return true;
    
    // 检查是否包含文件扩展名
    if (/\.(json|md|txt|log|yaml|yml|xml|ini|conf|cfg)$/i.test(str)) return true;
    
    return false;
  }

  // 将绝对路径转换为相对路径或占位符路径
  convertToPortablePath(absolutePath) {
    if (!absolutePath) return absolutePath;
    
    console.log(`[DEBUG] convertToPortablePath - 输入: ${absolutePath}`);
    
    // 如果看起来不像路径，直接返回
    if (!this.looksLikePath(absolutePath)) {
      console.log(`[DEBUG] convertToPortablePath - 看起来不像路径，直接返回`);
      return absolutePath;
    }
    
    const placeholders = this.getPathPlaceholders();
    
    // 1. 首先尝试匹配占位符路径
    for (const [placeholder, realPath] of Object.entries(placeholders)) {
      if (realPath && absolutePath.startsWith(realPath)) {
        const relativePart = absolutePath.substring(realPath.length).replace(/^[\\/]/, '');
        const converted = relativePart ? `${placeholder}/${relativePart}` : placeholder;
        console.log(`[DEBUG] convertToPortablePath - 匹配占位符: ${placeholder}, 结果: ${converted}`);
        return converted;
      }
    }
    
    console.log(`[DEBUG] convertToPortablePath - 没有匹配到占位符`);
    
    // 2. 尝试转换为相对路径（相对于当前工作目录）
    try {
      const relativePath = path.relative(process.cwd(), absolutePath);
      // 如果相对路径不以..开头，说明在当前工作目录下
      if (!relativePath.startsWith('..')) {
        console.log(`[DEBUG] convertToPortablePath - 转换为相对路径: ${relativePath}`);
        return relativePath;
      }
    } catch (error) {
      // 忽略错误，继续处理
    }
    
    // 3. 尝试转换为相对路径（相对于用户主目录）
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir && absolutePath.startsWith(homeDir)) {
      const relativePart = absolutePath.substring(homeDir.length).replace(/^[\\/]/, '');
      const converted = `{HOME}/${relativePart}`;
      console.log(`[DEBUG] convertToPortablePath - 转换为HOME相对路径: ${converted}`);
      return converted;
    }
    
    // 4. 如果都无法转换，返回原始路径
    console.log(`[DEBUG] convertToPortablePath - 无法转换，返回原始路径`);
    return absolutePath;
  }

  // 将占位符路径转换为绝对路径
  convertToAbsolutePath(portablePath) {
    if (!portablePath) return portablePath;
    
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

  // 清理配置中的路径，转换为可移植的路径
  sanitizeConfigPaths(config) {
    console.log(`[DEBUG] sanitizeConfigPaths - 输入类型: ${typeof config}`);
    
    if (!config) return config;
    
    if (typeof config === 'string') {
      const converted = this.convertToPortablePath(config);
      if (converted !== config) {
        console.log(`[DEBUG] 路径转换: ${config} -> ${converted}`);
      }
      return converted;
    }
    
    if (Array.isArray(config)) {
      console.log(`[DEBUG] sanitizeConfigPaths - 处理数组，长度: ${config.length}`);
      return config.map(item => this.sanitizeConfigPaths(item));
    }
    
    if (typeof config === 'object') {
      console.log(`[DEBUG] sanitizeConfigPaths - 处理对象，键: ${Object.keys(config).join(', ')}`);
      const sanitized = {};
      for (const [key, value] of Object.entries(config)) {
        // 检查键名是否包含路径相关的词
        const isPathKey = /path|directory|folder|location|file|log|workspace|home/i.test(key);
        
        console.log(`[DEBUG] sanitizeConfigPaths - 键: ${key}, 值类型: ${typeof value}, 是否路径键: ${isPathKey}`);
        
        if (isPathKey && typeof value === 'string') {
          const converted = this.convertToPortablePath(value);
          if (converted !== value) {
            console.log(`[DEBUG] 路径转换 [${key}]: ${value} -> ${converted}`);
          }
          sanitized[key] = converted;
        } else {
          sanitized[key] = this.sanitizeConfigPaths(value);
        }
      }
      return sanitized;
    }
    
    return config;
  }

  async detectOpenClawDirectory() {
    const possiblePaths = [
      process.env.OPENCLAW_HOME,
      path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw'),
      path.join(process.env.HOME || process.env.USERPROFILE, 'AppData', 'Local', 'openclaw'),
      path.join(process.env.HOME || process.env.USERPROFILE, 'AppData', 'Roaming', 'openclaw'),
      'C:\\Users\\' + (process.env.USERNAME || 'Public') + '\\.openclaw',
      'C:\\Users\\' + (process.env.USERNAME || 'Public') + '\\AppData\\Local\\openclaw',
      'C:\\Users\\' + (process.env.USERNAME || 'Public') + '\\AppData\\Roaming\\openclaw',
      '/home/' + (process.env.USER || process.env.USERNAME || 'root') + '/.openclaw',
    ];

    for (const dirPath of possiblePaths) {
      if (!dirPath) continue;
      try {
        const stat = await fs.stat(dirPath);
        if (stat.isDirectory()) {
          console.log(`Checking directory: ${dirPath}`);
          if (await this.isValidOpenClawDirectory(dirPath)) {
            console.log(`Found valid OpenClaw directory: ${dirPath}`);
            return dirPath;
          }
        }
      } catch (error) {
        console.log(`Cannot access ${dirPath}: ${error.message}`);
        continue;
      }
    }

    console.log('No valid OpenClaw directory found');
    return null;
  }

  async isValidOpenClawDirectory(dirPath) {
    const indicatorFiles = [
      'openclaw.json',
      'agents',
      'memory',
      'workspace'
    ];

    try {
      const files = await fs.readdir(dirPath);
      const hasIndicator = files.some(file => indicatorFiles.includes(file));
      
      if (hasIndicator) return true;

      return false;
    } catch (error) {
      return false;
    }
  }

  async detectWorkspaceDirectory() {
    const possiblePaths = [
      process.env.OPENCLAW_WORKSPACE,
      process.env.WORKSPACE,
      path.join(process.env.HOME || process.env.USERPROFILE, 'workspace'),
      path.join(process.env.HOME || process.env.USERPROFILE, 'Projects'),
      'D:\\Projects',
      'D:\\Projects\\workspace',
      'C:\\Projects',
      'C:\\Projects\\workspace',
      path.join('D:\\Projects', process.env.USERNAME || 'user'),
      path.join('D:\\Projects', process.env.USERNAME || 'user', 'workspace'),
      path.join(process.env.HOME || process.env.USERPROFILE, 'Documents\\workspace'),
      path.join(process.env.HOME || process.env.USERPROFILE, 'Documents\\Projects')
    ];

    for (const dirPath of possiblePaths) {
      if (!dirPath) continue;
      try {
        const stat = await fs.stat(dirPath);
        if (stat.isDirectory()) {
          console.log(`Checking workspace: ${dirPath}`);
          
          const openclawDir = path.join(dirPath, '.openclaw');
          try {
            await fs.access(openclawDir);
            console.log(`Found valid workspace with .openclaw: ${dirPath}`);
            return dirPath;
          } catch (error) {
            const memoryDir = path.join(dirPath, 'memory');
            try {
              await fs.access(memoryDir);
              console.log(`Found valid workspace with memory: ${dirPath}`);
              return dirPath;
            } catch (error) {
              const memoryFile = path.join(dirPath, 'MEMORY.md');
              try {
                await fs.access(memoryFile);
                console.log(`Found valid workspace with MEMORY.md: ${dirPath}`);
                return dirPath;
              } catch (error) {
                console.log(`Workspace ${dirPath} exists but no .openclaw, memory, or MEMORY.md found`);
                continue;
              }
            }
          }
        }
      } catch (error) {
        console.log(`Cannot access ${dirPath}: ${error.message}`);
        continue;
      }
    }

    console.log('No valid workspace directory found');
    return null;
  }

  async findConfigFiles(directory) {
    const configFiles = [];
    const possibleConfigNames = [
      'openclaw.json',
      'MEMORY.md',
      'PROJECT_PLAN.md',
      'TASK_STATUS.md',
      'AGENTS.md',
      'IDENTITY.md',
      'MEMORY.md',
      'TOOLS.md',
      'USER.md',
      'HEARTBEAT.md',
      'SOUL.md',
      'BOOTSTRAP.md'
    ];

    console.log(`[DEBUG] ========== 开始扫描目录: ${directory} ==========`);
    console.log(`[DEBUG] 正在查找配置文件，目录: ${directory}`);
    
    // 记录到日志系统
    await logService.createLog(1, {
      operation_stage: 'configuration',
      level: 'debug',
      content: `开始扫描目录: ${directory}`,
      metadata: { directory }
    });

    try {
      const files = await fs.readdir(directory);
      console.log(`[DEBUG] 目录中的文件:`, files);
      
      // 记录到日志系统
      await logService.createLog(1, {
        operation_stage: 'configuration',
        level: 'debug',
        content: `目录中的文件: ${files.join(', ')}`,
        metadata: { files }
      });
      
      for (const file of files) {
        const lowerFile = file.toLowerCase();
        if (possibleConfigNames.map(n => n.toLowerCase()).includes(lowerFile)) {
          const filePath = path.join(directory, file);
          configFiles.push(filePath);
          console.log(`[DEBUG] 找到配置文件: ${file}`);
          
          // 记录到日志系统
          await logService.createLog(1, {
            operation_stage: 'configuration',
            level: 'debug',
            content: `找到配置文件: ${file}`,
            metadata: { file, fullPath: path.join(directory, file) }
          });
        }
      }

      const memoryDir = path.join(directory, 'memory');
      try {
        const stat = await fs.stat(memoryDir);
        if (stat.isDirectory()) {
          const memoryFiles = await fs.readdir(memoryDir);
          for (const file of memoryFiles) {
            if (file.endsWith('.md')) {
              configFiles.push(path.join(memoryDir, file));
              console.log(`[DEBUG] 找到memory文件: ${file}`);
            }
          }
        }
      } catch (error) {
      }

      const agentsDir = path.join(directory, 'agents');
      try {
        const stat = await fs.stat(agentsDir);
        if (stat.isDirectory()) {
          console.log(`[DEBUG] 找到agents目录: ${agentsDir}`);
          const agentDirs = await fs.readdir(agentsDir);
          console.log(`[DEBUG] agents子目录:`, agentDirs);
          for (const agentDir of agentDirs) {
            const agentPath = path.join(agentsDir, agentDir);
            const agentStat = await fs.stat(agentPath);
            if (agentStat.isDirectory()) {
              const agentFiles = await fs.readdir(agentPath);
              console.log(`[DEBUG] Agent ${agentDir} 中的文件:`, agentFiles);
              
              for (const file of agentFiles) {
                const filePath = path.join(agentPath, file);
                const fileStat = await fs.stat(filePath);
                
                if (fileStat.isDirectory()) {
                  console.log(`[DEBUG] ${file} 是目录，检查子目录`);
                  
                  const subAgentPath = filePath;
                  const subAgentFiles = await fs.readdir(subAgentPath);
                  console.log(`[DEBUG] ${file} 子目录中的文件:`, subAgentFiles);
                  
                  for (const subFile of subAgentFiles) {
                    const subFilePath = path.join(subAgentPath, subFile);
                    const subFileStat = await fs.stat(subFilePath);
                    
                    if (subFileStat.isDirectory()) {
                      console.log(`[DEBUG] ${subFile} 是目录，跳过`);
                      continue;
                    }
                    
                    if (subFile.endsWith('.json')) {
                      configFiles.push(subFilePath);
                      console.log(`[DEBUG] 找到Agent配置文件: ${subFilePath}`);
                    }
                  }
                  continue;
                }
                
                if (file.endsWith('.json')) {
                  configFiles.push(filePath);
                  console.log(`[DEBUG] 找到Agent配置文件: ${filePath}`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.log('No agents directory found:', error.message);
      }

      const openclawDir = path.join(directory, '.openclaw');
      try {
        const stat = await fs.stat(openclawDir);
        if (stat.isDirectory()) {
          console.log(`[DEBUG] 找到.openclaw目录: ${openclawDir}`);
          const openclawFiles = await fs.readdir(openclawDir);
          console.log(`[DEBUG] .openclaw目录中的文件:`, openclawFiles);
          
          // 记录到日志系统
          await logService.createLog(1, {
            operation_stage: 'configuration',
            level: 'debug',
            content: `.openclaw目录中的文件: ${openclawFiles.join(', ')}`,
            metadata: { openclawDir, openclawFiles }
          });
          
          for (const file of openclawFiles) {
            if (file.endsWith('.json') || file.endsWith('.md')) {
              configFiles.push(path.join(openclawDir, file));
              console.log(`[DEBUG] 找到.openclaw配置文件: ${file}`);
              
              // 记录到日志系统
              await logService.createLog(1, {
                operation_stage: 'configuration',
                level: 'debug',
                content: `找到.openclaw配置文件: ${file}`,
                metadata: { file, fullPath: path.join(openclawDir, file) }
              });
            }
          }
          
          const openclawAgentsDir = path.join(openclawDir, 'agents');
          try {
            const openclawAgentsStat = await fs.stat(openclawAgentsDir);
            if (openclawAgentsStat.isDirectory()) {
              console.log(`[DEBUG] 找到.openclaw/agents目录: ${openclawAgentsDir}`);
              const openclawAgentDirs = await fs.readdir(openclawAgentsDir);
              console.log(`[DEBUG] .openclaw/agents子目录:`, openclawAgentDirs);
              for (const agentDir of openclawAgentDirs) {
                const agentPath = path.join(openclawAgentsDir, agentDir);
                const agentStat = await fs.stat(agentPath);
                if (agentStat.isDirectory()) {
                  const agentFiles = await fs.readdir(agentPath);
                  console.log(`[DEBUG] Agent ${agentDir} 中的文件:`, agentFiles);
                  for (const file of agentFiles) {
                    const filePath = path.join(agentPath, file);
                    const fileStat = await fs.stat(filePath);
                    
                    if (fileStat.isDirectory()) {
                      console.log(`[DEBUG] ${file} 是目录，跳过`);
                      continue;
                    }
                    
                    if (file.endsWith('.json') || file === 'agent.json') {
                      configFiles.push(filePath);
                      console.log(`[DEBUG] 找到.openclaw/agents配置文件: ${filePath}`);
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.log('No .openclaw/agents directory found:', error.message);
          }
          
          const openclawSkillsDir = path.join(openclawDir, 'skills');
          try {
            const openclawSkillsStat = await fs.stat(openclawSkillsDir);
            if (openclawSkillsStat.isDirectory()) {
              console.log(`[DEBUG] 找到.openclaw/skills目录: ${openclawSkillsDir}`);
              const skillDirs = await fs.readdir(openclawSkillsDir);
              console.log(`[DEBUG] .openclaw/skills子目录:`, skillDirs);
              for (const skillDir of skillDirs) {
                const skillPath = path.join(openclawSkillsDir, skillDir);
                const skillStat = await fs.stat(skillPath);
                if (skillStat.isDirectory()) {
                  const skillFiles = await fs.readdir(skillPath);
                  console.log(`[DEBUG] 技能 ${skillDir} 中的文件:`, skillFiles);
                  for (const file of skillFiles) {
                    const filePath = path.join(skillPath, file);
                    const fileStat = await fs.stat(filePath);
                    
                    if (fileStat.isDirectory()) {
                      console.log(`[DEBUG] ${file} 是目录，跳过`);
                      continue;
                    }
                    
                    if (file.endsWith('.md') || file.endsWith('.json') || file.endsWith('.js')) {
                      configFiles.push(filePath);
                      console.log(`[DEBUG] 找到技能文件: ${filePath}`);
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.log('No .openclaw/skills directory found:', error.message);
          }
        }
      } catch (error) {
        console.log('No .openclaw directory found:', error.message);
      }
      
      const skillsDir = path.join(directory, 'skills');
      try {
        const skillsStat = await fs.stat(skillsDir);
        if (skillsStat.isDirectory()) {
          console.log(`[DEBUG] 找到skills目录: ${skillsDir}`);
          const skillDirs = await fs.readdir(skillsDir);
          console.log(`[DEBUG] skills子目录:`, skillDirs);
          for (const skillDir of skillDirs) {
            const skillPath = path.join(skillsDir, skillDir);
            const skillStat = await fs.stat(skillPath);
            if (skillStat.isDirectory()) {
              const skillFiles = await fs.readdir(skillPath);
              console.log(`[DEBUG] 技能 ${skillDir} 中的文件:`, skillFiles);
              for (const file of skillFiles) {
                const filePath = path.join(skillPath, file);
                const fileStat = await fs.stat(filePath);
                
                if (fileStat.isDirectory()) {
                  console.log(`[DEBUG] ${file} 是目录，跳过`);
                  continue;
                }
                
                if (file.endsWith('.md') || file.endsWith('.json') || file.endsWith('.js')) {
                  configFiles.push(filePath);
                  console.log(`[DEBUG] 找到技能文件: ${filePath}`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.log('No skills directory found:', error.message);
      }
      
      const workspaceDirs = files.filter(file => {
        const lowerFile = file.toLowerCase();
        return lowerFile.startsWith('workspace-') || lowerFile === 'workspace';
      });
      
      console.log(`[DEBUG] 找到的workspace目录:`, workspaceDirs);
      console.log(`[DEBUG] workspace目录数量:`, workspaceDirs.length);
      
      // 记录到日志系统
      await logService.createLog(1, {
        operation_stage: 'configuration',
        level: 'debug',
        content: `找到的workspace目录: ${workspaceDirs.join(', ')}`,
        metadata: { workspaceDirs, count: workspaceDirs.length }
      });
      
      for (const workspaceDir of workspaceDirs) {
        const workspacePath = path.join(directory, workspaceDir);
        console.log(`[DEBUG] 正在处理workspace目录: ${workspacePath}`);
        try {
          const stat = await fs.stat(workspacePath);
          if (stat.isDirectory()) {
            console.log(`[DEBUG] 找到workspace目录: ${workspacePath}`);
            const workspaceFiles = await fs.readdir(workspacePath);
            console.log(`[DEBUG] workspace目录中的文件:`, workspaceFiles);
            
            // 记录到日志系统
            await logService.createLog(1, {
              operation_stage: 'configuration',
              level: 'debug',
              content: `workspace目录中的文件: ${workspaceFiles.join(', ')}`,
              metadata: { workspaceDir, workspaceFiles }
            });
            
            for (const file of workspaceFiles) {
              const lowerFile = file.toLowerCase();
              if (lowerFile === 'agents.md' || lowerFile === 'soul.md') {
                configFiles.push(path.join(workspacePath, file));
                console.log(`[DEBUG] 找到workspace配置文件: ${file}`);
                
                // 记录到日志系统
                await logService.createLog(1, {
                  operation_stage: 'configuration',
                  level: 'debug',
                  content: `找到workspace配置文件: ${file}`,
                  metadata: { 
                    workspaceDir, 
                    file, 
                    fullPath: path.join(workspacePath, file) 
                  }
                });
              }
            }
          } else {
            console.log(`[DEBUG] ${workspacePath} 不是目录`);
          }
        } catch (error) {
          console.log(`Error accessing workspace directory ${workspaceDir}:`, error.message);
        }
      }
      
      // 扫描skills目录
      const skillsDirName = files.find(file => file.toLowerCase() === 'skills');
      if (skillsDirName) {
        const skillsPath = path.join(directory, skillsDirName);
        console.log(`[DEBUG] 正在处理skills目录: ${skillsPath}`);
        try {
          const stat = await fs.stat(skillsPath);
          if (stat.isDirectory()) {
            const skillDirs = await fs.readdir(skillsPath);
            console.log(`[DEBUG] skills目录中的子目录:`, skillDirs);
            
            // 记录到日志系统
            await logService.createLog(1, {
              operation_stage: 'configuration',
              level: 'debug',
              content: `skills目录中的子目录: ${skillDirs.join(', ')}`,
              metadata: { skillDirs, count: skillDirs.length }
            });
            
            for (const skillDir of skillDirs) {
              const skillPath = path.join(skillsPath, skillDir);
              try {
                const skillStat = await fs.stat(skillPath);
                if (skillStat.isDirectory()) {
                  const skillFiles = await fs.readdir(skillPath);
                  console.log(`[DEBUG] 技能 ${skillDir} 中的文件:`, skillFiles);
                  
                  // 记录到日志系统
                  await logService.createLog(1, {
                    operation_stage: 'configuration',
                    level: 'debug',
                    content: `技能 ${skillDir} 中的文件: ${skillFiles.join(', ')}`,
                    metadata: { skillDir, skillFiles }
                  });
                  
                  for (const file of skillFiles) {
                    const filePath = path.join(skillPath, file);
                    const fileStat = await fs.stat(filePath);
                    
                    if (fileStat.isDirectory()) {
                      console.log(`[DEBUG] ${file} 是目录，跳过`);
                      continue;
                    }
                    
                    if (file.endsWith('.md') || file.endsWith('.json') || file.endsWith('.js')) {
                      configFiles.push(filePath);
                      console.log(`[DEBUG] 找到技能文件: ${filePath}`);
                      
                      // 记录到日志系统
                      await logService.createLog(1, {
                        operation_stage: 'configuration',
                        level: 'debug',
                        content: `找到技能文件: ${file}`,
                        metadata: { 
                          skillDir, 
                          file, 
                          fullPath: filePath 
                        }
                      });
                    }
                  }
                }
              } catch (error) {
                console.log(`Error accessing skill directory ${skillDir}:`, error.message);
              }
            }
          }
        } catch (error) {
          console.log('No skills directory found:', error.message);
        }
      }
    } catch (error) {
      console.error('[DEBUG] Error reading directory:', error);
    }

    console.log(`[DEBUG] 总共找到 ${configFiles.length} 个配置文件:`, configFiles);
    console.log(`[DEBUG] 准备返回配置文件数组`);
    console.log(`[DEBUG] configFiles数组长度:`, configFiles.length);
    return configFiles;
  }

  async readConfigFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);
      
      console.log(`[DEBUG] readConfigFile - 文件名: ${fileName}, 扩展名: ${ext}, 文件路径: ${filePath}`);
      console.log(`[DEBUG] readConfigFile - 扩展名比较: "${ext}" === ".json" = ${ext === '.json'}`);
      
      if (ext === '.json' || fileName === 'agent') {
        try {
          const config = JSON.parse(content);
          console.log(`[DEBUG] readConfigFile - 解析JSON成功，开始清理路径`);
          // 清理配置中的路径，转换为可移植的路径
          const sanitized = this.sanitizeConfigPaths(config);
          console.log(`[DEBUG] readConfigFile - 路径清理完成`);
          return sanitized;
        } catch (error) {
          console.error(`[DEBUG] Failed to parse JSON from ${filePath}:`, error.message);
          throw new Error(`Failed to parse JSON from ${fileName}: ${error.message}`);
        }
      } else if (ext === '.md') {
        return {
          type: 'markdown',
          fileName: fileName,
          content: content,
          filePath: filePath
        };
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }
    } catch (error) {
      throw new Error(`Failed to read config file: ${error.message}`);
    }
  }

  sanitizeConfig(config) {
    const sensitiveFields = [
      'apiKey',
      'token',
      'password',
      'secret',
      'privateKey',
      'accessToken',
      'refreshToken',
      'authToken'
    ];

    const sanitized = JSON.parse(JSON.stringify(config));

    function sanitizeObject(obj) {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      for (const key in obj) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()));
        
        if (isSensitive && typeof obj[key] === 'string') {
          obj[key] = `your_${key}_here`;
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
    }

    sanitizeObject(sanitized);
    return sanitized;
  }

  async importFromLocalDirectory(directoryPath) {
    try {
      const stat = await fs.stat(directoryPath);
      if (!stat.isDirectory()) {
        throw new Error('Path is not a directory');
      }

      const configFiles = await this.findConfigFiles(directoryPath);
      
      if (configFiles.length === 0) {
        throw new Error('No configuration files found in the directory');
      }

      // 确定目录类型
      let directoryType = 'unknown';
      const dirName = path.basename(directoryPath).toLowerCase();
      if (dirName === '.openclaw' || dirName === 'openclaw') {
        directoryType = 'openclaw_config';
      } else if (dirName.startsWith('workspace-')) {
        directoryType = dirName;
      } else if (dirName === 'workspace') {
        directoryType = 'workspace';
      } else if (dirName === 'skills') {
        directoryType = 'skills';
      }

      console.log(`[DEBUG] 目录类型: ${directoryType}, 目录名称: ${dirName}`);
      
      // 记录到日志系统
      await logService.createLog(1, {
        operation_stage: 'configuration',
        level: 'debug',
        content: `目录类型: ${directoryType}, 目录名称: ${dirName}`,
        metadata: { directoryType, dirName, directoryPath }
      });

      // 定义要排除的文件
      const excludedFiles = [
        'sessions.json',
        'sessions.jsonl',
        'memory.md',
        'user.md',
        'tools.md',
        'MEMORY.md',
        'USER.md',
        'TOOLS.md'
      ];

      const configs = [];
      for (const filePath of configFiles) {
        const fileName = path.basename(filePath);
        
        // 检查是否在排除列表中（不区分大小写）
        if (excludedFiles.some(excluded => excluded.toLowerCase() === fileName.toLowerCase())) {
          console.log(`[DEBUG] 跳过排除文件: ${fileName}`);
          continue;
        }
        
        try {
          console.log(`[DEBUG] 正在处理文件: ${filePath}`);
          const config = await this.readConfigFile(filePath);
          // readConfigFile已经处理了路径转换，不需要再调用sanitizeConfig
          const sanitized = config;
          const relativePath = path.relative(directoryPath, filePath).replace(/\\/g, '/');
          
          // 获取文件大小
          const stats = await fs.stat(filePath);
          const fileSize = stats.size;
          const fileSizeKB = (fileSize / 1024).toFixed(2);
          const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
          const fileSizeStr = fileSizeMB > 1 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`;
          
          // 根据文件的相对路径确定directoryType
          let fileDirectoryType = directoryType;
          const pathParts = relativePath.split(path.sep);
          
          if (pathParts[0] === 'openclaw.json') {
            fileDirectoryType = 'openclaw_config';
          } else if (pathParts[0] === 'agents') {
            fileDirectoryType = 'agent_config';
          } else if (pathParts[0].startsWith('workspace-')) {
            fileDirectoryType = 'workspace_config';
          } else if (pathParts[0] === 'skills') {
            fileDirectoryType = 'skill_config';
          }
          
          configs.push({
            fileName: path.basename(filePath),
            filePath: filePath,
            relativePath: relativePath,
            config: sanitized,
            directoryType: fileDirectoryType,
            fileSize: fileSize,
            fileSizeStr: fileSizeStr
          });
          console.log(`[DEBUG] 成功处理文件: ${filePath}, 文件类型: ${config.type}, 目录类型: ${fileDirectoryType}, 文件大小: ${fileSizeStr}`);
        } catch (error) {
          console.error(`[DEBUG] Error reading ${filePath}:`, error.message);
          console.error(`[DEBUG] Error stack:`, error.stack);
        }
      }

      console.log(`[DEBUG] 成功处理 ${configs.length} 个文件，总共扫描了 ${configFiles.length} 个文件`);
      
      return {
        success: true,
        directory: directoryPath,
        configFiles: configFiles,
        configs: configs
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async importFromBothDirectories(openClawConfigDir, workspaceDir) {
    console.log(`[DEBUG] importFromBothDirectories - openClawConfigDir: ${openClawConfigDir}, workspaceDir: ${workspaceDir}`);
    
    try {
      const results = {
        success: true,
        openClawConfigDir: openClawConfigDir,
        workspaceDir: workspaceDir,
        configs: []
      };

      if (openClawConfigDir) {
        console.log(`[DEBUG] importFromBothDirectories - 开始处理openClawConfigDir: ${openClawConfigDir}`);
        try {
          const openClawResult = await this.importFromLocalDirectory(openClawConfigDir);
          console.log(`[DEBUG] importFromBothDirectories - openClawResult: ${JSON.stringify(openClawResult, null, 2)}`);
          if (openClawResult.success) {
            // 直接使用importFromLocalDirectory返回的configs，不重新构造
            results.configs.push(...openClawResult.configs.map(config => ({
              directory: openClawConfigDir,
              directoryType: config.directoryType,
              files: [config]
            })));
          }
        } catch (error) {
          console.error('Error importing OpenClaw config directory:', error);
        }
      }

      if (workspaceDir) {
        try {
          const workspaceResult = await this.importFromLocalDirectory(workspaceDir);
          if (workspaceResult.success) {
            // 直接使用importFromLocalDirectory返回的configs，不重新构造
            results.configs.push(...workspaceResult.configs.map(config => ({
              directory: workspaceDir,
              directoryType: config.directoryType,
              files: [config]
            })));
          }
        } catch (error) {
          console.error('Error importing workspace directory:', error);
        }
      }

      if (results.configs.length === 0) {
        throw new Error('No configuration files found in any directory');
      }

      return results;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createTemplateFromLocalConfig(configData, templateInfo) {
    try {
      const template = {
        name: templateInfo.name,
        description: templateInfo.description || 'Imported from local configuration',
        category: templateInfo.category || 'custom',
        version: templateInfo.version || '1.0.0',
        config_content: configData,
        os_type: templateInfo.os_type || this.detectOSType(),
        hardware_requirements: templateInfo.hardware_requirements || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'draft',
        created_by: templateInfo.userId
      };

      return template;
    } catch (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }
  }

  async createTemplateFromLocalConfigs(configsArray, templateInfo) {
    try {
      const mergedConfig = {
        meta: {},
        configs: {},
        files: []
      };

      configsArray.forEach(configItem => {
        const { fileName, filePath, relativePath, config } = configItem;
        
        // 使用相对路径作为标识
        const displayPath = relativePath || fileName;
        
        if (config.type === 'markdown') {
          mergedConfig.files.push({
            fileName,
            filePath,
            relativePath: displayPath,
            type: 'markdown',
            content: config.content
          });
        } else {
          if (config.meta && config.meta.lastTouchedVersion) {
            mergedConfig.meta.lastTouchedVersion = config.meta.lastTouchedVersion;
            mergedConfig.meta.lastTouchedAt = config.meta.lastTouchedAt;
          }

          if (fileName === 'openclaw.json') {
            mergedConfig.mainConfig = {
              ...config,
              relativePath: displayPath
            };
          } else if (fileName.endsWith('.json')) {
            const configName = fileName.replace('.json', '');
            mergedConfig.configs[configName] = {
              ...config,
              relativePath: displayPath
            };
          }
        }
      });

      // 添加API配置说明文档
      const apiGuideContent = `# API密钥配置指南

## 🎯 两种方式任选

### 方式一：使用测试API（快速体验）
适合初次体验，无需注册，免费10次调用。

**配置：**
\`\`\`json
{
  "api": {
    "provider": "openai",
    "key": "oc_xxx",
    "secret": "yyy",
    "proxy_url": "http://your-server.com/api/proxy/proxy"
  }
}
\`\`\`

### 方式二：使用自己的API密钥（推荐）
适合长期使用，无限制，支持所有模型。

**配置：**
\`\`\`json
{
  "api": {
    "provider": "openai",
    "key": "sk-your-own-api-key",
    "base_url": "https://api.openai.com/v1"
  }
}
\`\`\`

## 🔑 如何获取自己的API密钥

1. 访问 https://platform.openai.com
2. 注册账号（可用Google账号）
3. 进入 "View API keys"
4. 点击 "Create new secret key"
5. 复制密钥并保存（只显示一次！）

## 🔄 切换方式

只需修改3个字段：
1. \`key\`: 从 \`oc_xxx\` 改为 \`sk-xxx\`
2. 删除 \`secret\` 和 \`proxy_url\`
3. 添加 \`base_url\`: \`https://api.openai.com/v1\`

## 💰 费用参考

- GPT-3.5-turbo: $0.001-0.003/次对话
- 新账号有$5免费额度

详细文档：https://platform.openai.com/docs
`;

      mergedConfig.files.push({
        fileName: 'API配置说明.md',
        relativePath: '.openclaw/API配置说明.md',
        type: 'markdown',
        content: apiGuideContent
      });

      const template = {
        name: templateInfo.name,
        description: templateInfo.description || `Imported ${configsArray.length} configuration files`,
        category: templateInfo.category || 'custom',
        version: templateInfo.version || '1.0.0',
        config_content: mergedConfig,
        config_count: configsArray.length + 1,
        os_type: templateInfo.os_type || this.detectOSType(),
        hardware_requirements: templateInfo.hardware_requirements || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'draft',
        created_by: templateInfo.userId
      };

      return template;
    } catch (error) {
      throw new Error(`Failed to create template from multiple configs: ${error.message}`);
    }
  }

  detectOSType() {
    const platform = process.platform;
    if (platform === 'win32') return 'Windows';
    if (platform === 'darwin') return 'macOS';
    if (platform === 'linux') return 'Linux';
    return 'Unknown';
  }

  async getSystemInfo() {
    const os = require('os');
    
    return {
      os_type: this.detectOSType(),
      os_version: os.release(),
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      total_memory: os.totalmem(),
      cpus: os.cpus(),
      uptime: os.uptime()
    };
  }

  async validateConfigStructure(config, fileName = '', filePath = null) {
    // 使用新的ConfigValidationService进行验证
    return await configValidationService.validateConfig(config, fileName, filePath);
  }
}

module.exports = new LocalConfigService();