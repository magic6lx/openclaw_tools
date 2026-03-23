const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class OpenClawInstallController {
  async checkSystem(req, res) {
    try {
      console.log('开始系统检查...');
      
      const checks = {
        nodeVersion: await this.checkNodeVersion(),
        platform: os.platform(),
        arch: os.arch(),
        path: process.env.PATH
      };

      try {
        checks.npmVersion = await this.checkNpmVersion();
        checks.npmInstalled = true;
      } catch (error) {
        console.error('检查npm版本失败:', error);
        checks.npmVersion = null;
        checks.npmError = error.message;
        checks.npmInstalled = false;
      }

      try {
        checks.npmPrefix = await this.getNpmPrefix();
      } catch (error) {
        console.error('获取npm prefix失败:', error);
        checks.npmPrefix = null;
        checks.prefixError = error.message;
      }

      try {
        checks.diskSpace = await this.checkDiskSpace();
      } catch (error) {
        console.error('检查磁盘空间失败:', error);
        checks.diskSpace = null;
        checks.diskError = error.message;
      }

      try {
        const networkResult = await this.checkNetworkConnection();
        checks.networkConnection = networkResult.connected;
        checks.networkRegistry = networkResult.registry;
        checks.networkUrl = networkResult.url;
      } catch (error) {
        console.error('检查网络连接失败:', error);
        checks.networkConnection = false;
        checks.networkError = error.message;
      }

      try {
        checks.permissions = await this.checkPermissions();
      } catch (error) {
        console.error('检查权限失败:', error);
        checks.permissions = false;
        checks.permissionsError = error.message;
      }

      try {
        checks.openclawInstalled = await this.checkOpenClawInstalled();
        if (checks.openclawInstalled) {
          checks.openclawVersion = await this.getOpenClawVersion();
        }
      } catch (error) {
        console.error('检查OpenClaw安装状态失败:', error);
        checks.openclawInstalled = false;
        checks.openclawError = error.message;
      }

      console.log('系统检查完成:', checks);

      res.json({
        success: true,
        data: checks
      });
    } catch (error) {
      console.error('系统检查失败:', error);
      res.status(500).json({
        success: false,
        message: error.message,
        stack: error.stack
      });
    }
  }

  async installOpenClaw(req, res) {
    try {
      const { upgrade = false } = req.body;

      const logFile = path.join(__dirname, '../../logs/openclaw-install.log');
      await fs.mkdir(path.dirname(logFile), { recursive: true });

      const logStream = fs.createWriteStream(logFile, { flags: 'a' });
      const log = (message) => {
        const timestamp = new Date().toISOString();
        logStream.write(`[${timestamp}] ${message}\n`);
      };

      log('=== 开始OpenClaw安装流程 ===');
      log(`系统信息: ${os.platform()} ${os.arch()}`);
      log(`Node版本: ${process.version}`);
      log(`升级模式: ${upgrade ? '是' : '否'}`);

      const checkResult = await this.checkNodeVersion();
      if (!checkResult.satisfies) {
        log('错误: Node版本不满足要求');
        log(`当前版本: ${checkResult.current}`);
        log(`要求版本: ${checkResult.required}`);
        logStream.end();
        return res.status(400).json({
          success: false,
          message: 'Node版本不满足要求',
          data: checkResult
        });
      }

      log('Node版本检查通过');

      const npmInstalled = await this.checkNpmInstalled();
      if (!npmInstalled) {
        log('警告: npm未安装，开始自动安装npm...');
        log('注意: npm通常随Node.js一起安装，如果Node已安装但npm未安装，可能需要重新安装Node.js');
        
        try {
          await this.installNpm(log);
          log('npm安装成功');
          
          const npmVersion = await this.checkNpmVersion();
          log(`npm版本: ${npmVersion}`);
        } catch (error) {
          log(`npm安装失败: ${error.message}`);
          logStream.end();
          return res.status(500).json({
            success: false,
            message: 'npm安装失败，请手动安装npm',
            error: error.message,
            suggestions: this.getInstallSuggestions(os.platform(), error)
          });
        }
      } else {
        const npmVersion = await this.checkNpmVersion();
        log(`npm已安装，版本: ${npmVersion}`);
      }

      log('检查可用的npm registry...');
      let workingRegistry = null;
      try {
        const networkResult = await this.checkNetworkConnection();
        workingRegistry = networkResult;
        log(`使用npm registry: ${networkResult.registry} (${networkResult.url})`);
      } catch (error) {
        log('警告: 无法连接到任何npm registry，尝试使用默认配置');
      }

      if (workingRegistry && workingRegistry.url) {
        log(`设置npm registry为: ${workingRegistry.url}`);
        await this.executeCommand(`npm config set registry ${workingRegistry.url}`, log);
      }

      const npmCommand = upgrade ? 'npm update -g openclaw' : 'npm install -g openclaw';
      log(`执行OpenClaw安装命令: ${npmCommand}`);

      try {
        await this.executeCommand(npmCommand, log);
        log('OpenClaw安装/升级成功');
      } catch (error) {
        log(`OpenClaw安装失败: ${error.message}`);
        log(`错误代码: ${error.code || 'unknown'}`);
        
        const suggestions = this.getOpenClawInstallSuggestions(error);
        if (suggestions.length > 0) {
          log('建议的解决方案:');
          suggestions.forEach((suggestion, index) => {
            log(`  ${index + 1}. ${suggestion}`);
          });
        }
        
        logStream.end();
        return res.status(500).json({
          success: false,
          message: 'OpenClaw安装失败',
          error: error.message,
          suggestions: suggestions
        });
      }

      log('验证安装...');
      try {
        await this.executeCommand('openclaw --version', log);
        await this.executeCommand('openclaw doctor', log);
        log('验证通过');
      } catch (error) {
        log(`验证失败: ${error.message}`);
      }

      log('检查PATH配置...');
      const npmPrefix = await this.getNpmPrefix();
      const binPath = path.join(npmPrefix, 'bin');
      log(`npm bin路径: ${binPath}`);

      const currentPath = process.env.PATH || '';
      if (!currentPath.includes(binPath)) {
        log('警告: PATH未包含npm bin路径');
        log(`建议添加到PATH: ${binPath}`);
      } else {
        log('PATH配置正确');
      }

      log('安装流程完成');
      logStream.end();

      res.json({
        success: true,
        message: upgrade ? 'OpenClaw升级成功' : 'OpenClaw安装成功',
        logFile: logFile
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async checkNodeVersion() {
    return new Promise((resolve) => {
      const current = process.version.replace('v', '');
      const required = '22.16.0';
      const satisfies = this.compareVersions(current, required) >= 0;

      resolve({
        current,
        required,
        satisfies
      });
    });
  }

  async checkNpmVersion() {
    return new Promise((resolve, reject) => {
      exec('npm -v', (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  async checkNpmInstalled() {
    return new Promise((resolve) => {
      exec('npm -v', (error, stdout) => {
        if (error) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async installNpm(logCallback) {
    return new Promise((resolve, reject) => {
      const platform = os.platform();
      let installScript;
      let installMethod;

      if (platform === 'win32') {
        installMethod = 'winget';
        installScript = 'winget install OpenJS.NodeJS.LTS';
      } else if (platform === 'darwin') {
        installMethod = 'brew';
        installScript = 'brew install node';
      } else {
        installMethod = 'curl';
        installScript = 'curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs';
      }
      
      logCallback(`安装npm方法: ${installMethod}`);
      logCallback(`执行安装命令: ${installScript}`);
      
      exec(installScript, { timeout: 300000 }, (error, stdout, stderr) => {
        if (stdout) {
          logCallback(`输出: ${stdout}`);
        }
        if (stderr) {
          logCallback(`错误输出: ${stderr}`);
        }
        if (error) {
          logCallback(`安装错误: ${error.message}`);
          logCallback(`错误代码: ${error.code || 'unknown'}`);
          
          const suggestions = this.getInstallSuggestions(platform, error);
          if (suggestions.length > 0) {
            logCallback(`建议的替代方案:`);
            suggestions.forEach((suggestion, index) => {
              logCallback(`  ${index + 1}. ${suggestion}`);
            });
          }
          
          reject(error);
        } else {
          logCallback(`安装命令执行成功`);
          resolve(stdout);
        }
      });
    });
  }

  getInstallSuggestions(platform, error) {
    const suggestions = [];
    
    if (platform === 'win32') {
      suggestions.push('使用官方安装包: https://nodejs.org/');
      suggestions.push('使用Chocolatey: choco install nodejs-lts');
      suggestions.push('手动下载并安装Node.js (包含npm)');
      suggestions.push('确保以管理员权限运行');
    } else if (platform === 'darwin') {
      suggestions.push('使用官方安装包: https://nodejs.org/');
      suggestions.push('确保已安装Homebrew: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
      suggestions.push('使用nvm安装: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash');
    } else {
      suggestions.push('使用nvm安装: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash');
      suggestions.push('使用官方安装包: https://nodejs.org/');
      suggestions.push('确保有sudo权限');
      suggestions.push('检查网络连接和DNS解析');
    }
    
    if (error.code === 'ENOENT') {
      suggestions.push('安装命令不存在，请先安装相关工具');
    } else if (error.code === 'EACCES') {
      suggestions.push('权限不足，请使用sudo或管理员权限');
    }
    
    return suggestions;
  }

  getOpenClawInstallSuggestions(error) {
    const suggestions = [];
    const platform = os.platform();
    
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      suggestions.push('权限不足，请使用管理员权限或sudo运行');
      suggestions.push('尝试使用管理员权限打开终端');
    } else if (error.code === 'ENOTFOUND' || error.code === '404') {
      suggestions.push('OpenClaw包不存在或网络问题');
      suggestions.push('检查网络连接');
      suggestions.push('尝试使用npm镜像源: npm config set registry https://registry.npmmirror.com');
    } else if (error.code === 'ETIMEDOUT') {
      suggestions.push('网络连接超时');
      suggestions.push('检查网络连接');
      suggestions.push('尝试使用代理或更换网络环境');
    } else if (error.message && error.message.includes('ECONNREFUSED')) {
      suggestions.push('网络连接被拒绝');
      suggestions.push('检查防火墙设置');
      suggestions.push('尝试使用npm镜像源');
    }
    
    suggestions.push('手动安装OpenClaw: npm install -g openclaw --verbose');
    suggestions.push('查看详细错误日志');
    suggestions.push('访问OpenClaw官方文档: https://docs.openclaw.ai');
    
    return suggestions;
  }

  async getNpmPrefix() {
    return new Promise((resolve, reject) => {
      exec('npm prefix -g', (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  async executeCommand(command, logCallback) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (stdout) {
          logCallback(`输出: ${stdout}`);
        }
        if (stderr) {
          logCallback(`错误: ${stderr}`);
        }
        if (error) {
          logCallback(`执行错误: ${error.message}`);
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  async checkDiskSpace() {
    return new Promise((resolve, reject) => {
      const platform = os.platform();
      let command;

      if (platform === 'win32') {
        command = 'wmic logicaldisk get size,freespace,caption';
      } else {
        command = 'df -h /';
      }

      exec(command, (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          try {
            const diskInfo = this.parseDiskSpace(stdout, platform);
            resolve(diskInfo);
          } catch (parseError) {
            reject(parseError);
          }
        }
      });
    });
  }

  parseDiskSpace(output, platform) {
    if (platform === 'win32') {
      const lines = output.trim().split('\n').slice(1);
      const disks = [];
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          const freeSpace = parseInt(parts[1]);
          const totalSpace = parseInt(parts[2]);
          const usedSpace = totalSpace - freeSpace;
          
          disks.push({
            drive: parts[0],
            totalSpace: (totalSpace / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
            freeSpace: (freeSpace / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
            usedSpace: (usedSpace / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
            freeSpaceGB: freeSpace / (1024 * 1024 * 1024),
            sufficient: freeSpace / (1024 * 1024 * 1024) >= 1
          });
        }
      }
      
      return disks;
    } else {
      const lines = output.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        const totalSpace = this.parseSizeToGB(parts[1]);
        const usedSpace = this.parseSizeToGB(parts[2]);
        const freeSpace = this.parseSizeToGB(parts[3]);
        
        return [{
          drive: '/',
          totalSpace: totalSpace + ' GB',
          freeSpace: freeSpace + ' GB',
          usedSpace: usedSpace + ' GB',
          freeSpaceGB: freeSpace,
          sufficient: freeSpace >= 1
        }];
      }
      
      return null;
    }
  }

  parseSizeToGB(sizeStr) {
    const match = sizeStr.match(/^(\d+\.?\d*)([KMGTP]?)/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    const multipliers = {
      '': 1,
      'K': 1 / 1024,
      'M': 1 / (1024 * 1024),
      'G': 1,
      'T': 1024,
      'P': 1024 * 1024
    };

    return (value * (multipliers[unit] || 1)).toFixed(2);
  }

  async checkNetworkConnection() {
    return new Promise(async (resolve, reject) => {
      const registries = [
        { name: '官方源', url: 'registry.npmjs.org' },
        { name: '淘宝镜像', url: 'registry.npmmirror.com' },
        { name: '华为镜像', url: 'mirrors.huaweicloud.com' }
      ];

      let lastError = null;
      let workingRegistry = null;

      for (const registry of registries) {
        try {
          const result = await this.pingRegistry(registry.url);
          if (result) {
            workingRegistry = registry;
            console.log(`成功连接到 ${registry.name}: ${registry.url}`);
            break;
          }
        } catch (error) {
          console.log(`无法连接到 ${registry.name}: ${error.message}`);
          lastError = error;
        }
      }

      if (workingRegistry) {
        resolve({
          connected: true,
          registry: workingRegistry.name,
          url: workingRegistry.url
        });
      } else {
        reject({
          message: '无法连接到任何npm registry',
          registries: registries.map(r => r.url),
          lastError: lastError?.message
        });
      }
    });
  }

  async pingRegistry(host) {
    return new Promise((resolve, reject) => {
      exec(`ping -n 1 -w 3000 ${host}`, (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  }

  async checkPermissions() {
    return new Promise((resolve, reject) => {
      const platform = os.platform();
      let testCommand;

      if (platform === 'win32') {
        testCommand = 'whoami /priv';
      } else {
        testCommand = 'sudo -n true';
      }

      exec(testCommand, (error, stdout) => {
        if (error) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async checkOpenClawInstalled() {
    return new Promise((resolve, reject) => {
      exec('openclaw --version', (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  }

  async getOpenClawVersion() {
    return new Promise((resolve, reject) => {
      exec('openclaw --version', (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  }

  async getInstallLogs(req, res) {
    try {
      const logFile = path.join(__dirname, '../../logs/openclaw-install.log');
      const content = await fs.readFile(logFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      res.json({
        success: true,
        data: {
          logFile,
          lines: lines.slice(-100),
          totalLines: lines.length
        }
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({
          success: true,
          data: {
            logFile,
            lines: [],
            totalLines: 0,
            message: '暂无安装日志'
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message
        });
      }
    }
  }

  async verifyInstallation(req, res) {
    try {
      const checks = {
        version: await this.checkOpenClawVersion(),
        doctor: await this.runOpenClawDoctor(),
        status: await this.checkOpenClawStatus()
      };

      const allPassed = checks.version.success && checks.doctor.success && checks.status.success;

      res.json({
        success: true,
        data: {
          ...checks,
          allPassed
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async checkOpenClawVersion() {
    return new Promise((resolve) => {
      exec('openclaw --version', (error, stdout) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true, version: stdout.trim() });
        }
      });
    });
  }

  async runOpenClawDoctor() {
    return new Promise((resolve) => {
      exec('openclaw doctor', (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: error.message, output: stderr });
        } else {
          resolve({ success: true, output: stdout });
        }
      });
    });
  }

  async checkOpenClawStatus() {
    return new Promise((resolve) => {
      exec('openclaw status', (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: error.message, output: stderr });
        } else {
          resolve({ success: true, output: stdout });
        }
      });
    });
  }
}

module.exports = new OpenClawInstallController();