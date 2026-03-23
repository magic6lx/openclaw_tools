const { spawn, exec } = require('child_process');
const os = require('os');
const LogService = require('../services/LogService');

class RuntimeMonitorController {
  constructor() {
    if (RuntimeMonitorController.instance) {
      return RuntimeMonitorController.instance;
    }
    
    this.cache = {
      systemInfo: null,
      processes: null,
      openclawStatus: null,
      servicesStatus: null,
      lastUpdate: 0,
      openclawPath: null,
      openclawInstalled: null
    };
    this.cacheTimeout = 1000;
    this.maxNodeProcesses = process.env.MAX_NODE_PROCESSES ? parseInt(process.env.MAX_NODE_PROCESSES) : 5;
    
    this.openclawOperation = {
      inProgress: false,
      action: null,
      startTime: null,
      progress: [],
      error: null,
      success: null
    };
    
    console.log(`运行监控配置: 最大Node.js进程数 = ${this.maxNodeProcesses}`);
    
    RuntimeMonitorController.instance = this;
  }
  
  static getInstance() {
    if (!RuntimeMonitorController.instance) {
      RuntimeMonitorController.instance = new RuntimeMonitorController();
    }
    return RuntimeMonitorController.instance;
  }

  async getSystemStatus(req, res) {
    try {
      const now = Date.now();
      const shouldRefresh = !this.cache.lastUpdate || (now - this.cache.lastUpdate > this.cacheTimeout);

      console.log(`getSystemStatus - shouldRefresh: ${shouldRefresh}, lastUpdate: ${this.cache.lastUpdate}, now: ${now}`);

      if (shouldRefresh) {
        console.log('开始刷新系统状态...');
        const nodeProcessCount = await this.getNodeProcessCount();
        
        if (nodeProcessCount > this.maxNodeProcesses) {
          console.warn(`Node.js进程数量过多: ${nodeProcessCount}，停止自动刷新`);
          await this.logError(req, 'getSystemStatus', new Error(`Node.js进程数量过多: ${nodeProcessCount}`));
          res.json({
            success: false,
            message: `Node.js进程数量过多 (${nodeProcessCount}个)，已停止自动刷新`,
            data: {
              system: this.cache.systemInfo,
              processes: this.cache.processes,
              openclaw: {
                ...this.cache.openclawStatus,
                status: '进程过多',
                running: false,
                consoleUrl: null,
                error: `Node.js进程数量过多 (${nodeProcessCount}个)，已停止自动刷新`
              },
              services: this.cache.servicesStatus
            }
          });
          return;
        } else {
          console.log('开始获取系统信息...');
          this.cache.systemInfo = await this.getSystemInfo();
          
          console.log('开始获取进程信息...');
          this.cache.processes = await this.getProcesses();
          
          console.log('开始获取OpenClaw状态...');
          this.cache.openclawStatus = await this.getOpenClawStatus();
          
          console.log('开始获取服务状态...');
          this.cache.servicesStatus = await this.getServicesStatus();
          
          this.cache.lastUpdate = now;
          console.log('系统状态刷新完成');
        }
      }

      const status = {
        system: this.cache.systemInfo,
        processes: this.cache.processes,
        openclaw: this.cache.openclawStatus,
        services: this.cache.servicesStatus
      };

      await this.logSuccess(req, 'getSystemStatus', '获取系统状态成功', { 
        cached: !shouldRefresh,
        nodeProcessCount: await this.getNodeProcessCount()
      });

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('获取系统状态失败:', error);
      await this.logError(req, 'getSystemStatus', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getNodeProcessCount() {
    return new Promise((resolve) => {
      const command = os.platform() === 'win32' 
        ? 'tasklist /fo csv | findstr /i "node.exe"'
        : 'ps aux | grep node | grep -v grep | wc -l';

      console.log(`执行进程检测命令: ${command}`);

      let timeout;
      let childProcess;

      try {
        childProcess = exec(command, { timeout: 3000 }, (error, stdout, stderr) => {
          if (timeout) clearTimeout(timeout);
          
          console.log(`进程检测结果 - error: ${error ? error.message : 'none'}, stdout: ${stdout ? stdout.trim() : 'empty'}, stderr: ${stderr ? stderr.trim() : 'empty'}`);
          
          if (error) {
            console.log(`进程检测失败，返回0`);
            resolve(0);
          } else {
            if (os.platform() === 'win32') {
              const lines = stdout.trim().split('\n').filter(line => line.trim());
              console.log(`检测到的Node.js进程数量: ${lines.length}`);
              lines.forEach((line, index) => {
                console.log(`进程 ${index + 1}: ${line.trim()}`);
              });
              resolve(lines.length);
            } else {
              const count = parseInt(stdout.trim());
              console.log(`检测到的Node.js进程数量: ${count}`);
              resolve(isNaN(count) ? 0 : count);
            }
          }
        });

        timeout = setTimeout(() => {
          console.log(`进程检测超时`);
          if (childProcess && childProcess.kill) {
            childProcess.kill();
          }
          resolve(0);
        }, 3000);
      } catch (err) {
        console.log(`进程检测异常: ${err.message}`);
        if (timeout) clearTimeout(timeout);
        resolve(0);
      }
    });
  }

  async logError(req, operation, error) {
    try {
      const userId = req.user?.userId || null;
      const invitationCode = req.user?.invitationCode || null;
      const deviceId = req.user?.deviceId || null;

      await LogService.createLog(userId, {
        operation_stage: 'runtime',
        level: 'error',
        content: `运行监控${operation}失败: ${error.message}`,
        metadata: {
          operation,
          error: error.stack,
          timestamp: new Date().toISOString()
        },
        invitation_code: invitationCode,
        device_id: deviceId
      });
    } catch (logError) {
      console.error('记录日志失败:', logError);
    }
  }

  async getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024),
      freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024),
      cpus: os.cpus().length,
      loadAverage: os.loadavg(),
      nodeVersion: process.version,
      npmVersion: await this.getNpmVersion()
    };
  }

  async getNpmVersion() {
    return new Promise((resolve) => {
      let timeout;
      let childProcess;

      try {
        childProcess = exec('npm -v', { timeout: 3000 }, (error, stdout) => {
          if (timeout) clearTimeout(timeout);
          if (error) {
            resolve('unknown');
          } else {
            resolve(stdout.trim());
          }
        });

        timeout = setTimeout(() => {
          if (childProcess && childProcess.kill) {
            childProcess.kill();
          }
          resolve('unknown');
        }, 3000);
      } catch (err) {
        if (timeout) clearTimeout(timeout);
        resolve('unknown');
      }
    });
  }

  async getProcesses() {
    return new Promise((resolve) => {
      const command = os.platform() === 'win32' 
        ? 'tasklist /fo csv | findstr /i "node.exe openclaw"'
        : 'ps aux | grep -E "(node|openclaw)" | grep -v grep';

      let timeout;
      let childProcess;

      try {
        childProcess = exec(command, { timeout: 3000 }, async (error, stdout) => {
          if (timeout) clearTimeout(timeout);
          if (error) {
            resolve({
              openclawProcesses: [],
              otherNodeProcesses: [],
              totalNodeProcesses: 0
            });
          } else {
            const allProcesses = this.parseProcessList(stdout);
            const separated = await this.separateProcesses(allProcesses);
            resolve(separated);
          }
        });

        timeout = setTimeout(() => {
          if (childProcess && childProcess.kill) {
            childProcess.kill();
          }
          resolve({
            openclawProcesses: [],
            otherNodeProcesses: [],
            totalNodeProcesses: 0
          });
        }, 3000);
      } catch (err) {
        if (timeout) clearTimeout(timeout);
        resolve({
          openclawProcesses: [],
          otherNodeProcesses: [],
          totalNodeProcesses: 0
        });
      }
    });
  }

  async separateProcesses(processes) {
    const openclawProcesses = [];
    const otherNodeProcesses = [];

    for (const proc of processes) {
      if (proc.name.toLowerCase().includes('openclaw')) {
        openclawProcesses.push({
          ...proc,
          type: 'openclaw',
          category: 'OpenClaw'
        });
      } else if (proc.name.toLowerCase().includes('node')) {
        const isRelated = await this.isNodeProcessRelatedToOpenClaw(proc.pid);
        if (isRelated) {
          openclawProcesses.push({
            ...proc,
            type: 'node',
            category: 'OpenClaw相关'
          });
        } else {
          otherNodeProcesses.push({
            ...proc,
            type: 'node',
            category: '其他应用'
          });
        }
      }
    }

    return {
      openclawProcesses,
      otherNodeProcesses,
      totalNodeProcesses: processes.filter(p => p.name.toLowerCase().includes('node')).length
    };
  }

  async isNodeProcessRelatedToOpenClaw(pid) {
    return new Promise((resolve) => {
      if (os.platform() !== 'win32') {
        resolve(false);
        return;
      }

      const command = `wmic process where ProcessId=${pid} get CommandLine`;
      let timeout;
      let childProcess;

      try {
        childProcess = exec(command, { timeout: 2000 }, (error, stdout) => {
          if (timeout) clearTimeout(timeout);
          if (error) {
            resolve(false);
          } else {
            const commandLine = stdout.toLowerCase();
            const isRelated = commandLine.includes('openclaw') || 
                           commandLine.includes('gateway') ||
                           commandLine.includes('18789');
            resolve(isRelated);
          }
        });

        timeout = setTimeout(() => {
          if (childProcess && childProcess.kill) {
            childProcess.kill();
          }
          resolve(false);
        }, 2000);
      } catch (err) {
        if (timeout) clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  parseProcessList(output) {
    const lines = output.trim().split('\n').filter(line => line.trim());
    const processes = [];

    for (const line of lines) {
      if (os.platform() === 'win32') {
        const parts = line.split(',').map(p => p.replace(/"/g, '').trim());
        if (parts.length >= 5) {
          processes.push({
            name: parts[0],
            pid: parseInt(parts[1]),
            memory: parts[4],
            cpu: 'N/A'
          });
        }
      } else {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 11) {
          processes.push({
            name: parts[10],
            pid: parseInt(parts[1]),
            cpu: parts[2] + '%',
            memory: parts[3] + '%'
          });
        }
      }
    }

    return processes;
  }

  async getOpenClawStatus() {
    try {
      const installed = await this.checkOpenClawInstalled();
      
      if (!installed) {
        return {
          installed: false,
          status: '未安装',
          version: null,
          running: false,
          consoleUrl: null,
          error: 'OpenClaw未安装'
        };
      }

      const version = await this.getOpenClawVersion();
      const status = await this.checkOpenClawRunning();

      return {
        installed: true,
        status: status.running ? '运行中' : '已停止',
        version: version,
        running: status.running,
        consoleUrl: status.consoleUrl,
        output: status.output
      };
    } catch (error) {
      console.error('获取OpenClaw状态失败:', error);
      return {
        installed: false,
        status: '状态未知',
        version: null,
        running: false,
        consoleUrl: null,
        error: error.message || '检查失败'
      };
    }
  }

  async checkOpenClawInstalled() {
    console.log('开始检测OpenClaw安装状态...');

    const methods = [
      () => this.checkOpenClawViaWhere(),
      () => this.checkOpenClawViaPowerShell(),
      () => this.checkOpenClawViaDirectExec(),
      () => this.checkOpenClawViaNpmList()
    ];

    for (const method of methods) {
      try {
        const result = await method();
        if (result) {
          console.log(`OpenClaw检测成功，使用方法: ${method.name}`);
          return true;
        }
      } catch (error) {
        console.log(`检测方法 ${method.name} 失败:`, error.message);
      }
    }

    console.log('所有检测方法均失败，OpenClaw未安装');
    return false;
  }

  async checkOpenClawViaWhere() {
    return new Promise((resolve) => {
      let timeout;
      let childProcess;

      try {
        const command = 'where openclaw';
        console.log(`执行where命令: ${command}`);
        
        childProcess = exec(command, { timeout: 3000 }, (error, stdout, stderr) => {
          console.log(`where命令回调被调用`);
          if (timeout) clearTimeout(timeout);
          
          const errorMsg = error ? error.message : 'none';
          const stdoutMsg = stdout ? stdout.trim() : 'empty';
          const stderrMsg = stderr ? stderr.trim() : 'empty';
          
          console.log(`where命令执行结果 - error: ${errorMsg}, stdout: ${stdoutMsg}, stderr: ${stderrMsg}`);
          
          if (!error && stdout.trim()) {
            const path = stdout.trim().split('\n')[0];
            console.log(`找到OpenClaw路径: ${path}`);
            this.cache.openclawPath = path;
            resolve(true);
          } else {
            resolve(false);
          }
        });

        timeout = setTimeout(() => {
          console.log(`where命令超时`);
          if (childProcess && childProcess.kill) {
            childProcess.kill();
          }
          resolve(false);
        }, 3000);
      } catch (err) {
        console.log(`where命令异常: ${err.message}`);
        if (timeout) clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  async checkOpenClawViaPowerShell() {
    return new Promise((resolve) => {
      let timeout;
      let childProcess;

      try {
        const command = 'powershell.exe -NoProfile -Command "Get-Command openclaw -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source"';
        console.log(`执行PowerShell命令: ${command}`);
        
        childProcess = exec(command, { timeout: 3000 }, (error, stdout, stderr) => {
          console.log(`PowerShell命令回调被调用`);
          if (timeout) clearTimeout(timeout);
          
          const errorMsg = error ? error.message : 'none';
          const stdoutMsg = stdout ? stdout.trim() : 'empty';
          const stderrMsg = stderr ? stderr.trim() : 'empty';
          
          console.log(`PowerShell命令执行结果 - error: ${errorMsg}, stdout: ${stdoutMsg}, stderr: ${stderrMsg}`);
          
          if (!error && stdout.trim()) {
            const path = stdout.trim();
            console.log(`通过PowerShell找到OpenClaw路径: ${path}`);
            this.cache.openclawPath = path;
            resolve(true);
          } else {
            resolve(false);
          }
        });

        timeout = setTimeout(() => {
          console.log(`PowerShell命令超时`);
          if (childProcess && childProcess.kill) {
            childProcess.kill();
          }
          resolve(false);
        }, 3000);
      } catch (err) {
        console.log(`PowerShell命令异常: ${err.message}`);
        if (timeout) clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  async checkOpenClawViaDirectExec() {
    return new Promise((resolve) => {
      let timeout;
      let childProcess;

      try {
        const command = 'openclaw --version';
        console.log(`执行openclaw --version命令: ${command}`);
        
        childProcess = exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
          console.log(`openclaw --version命令回调被调用`);
          if (timeout) clearTimeout(timeout);
          
          const errorMsg = error ? error.message : 'none';
          const stdoutMsg = stdout ? stdout.trim() : 'empty';
          const stderrMsg = stderr ? stderr.trim() : 'empty';
          
          console.log(`openclaw --version执行结果 - error: ${errorMsg}, stdout: ${stdoutMsg}, stderr: ${stderrMsg}`);
          
          if (!error && stdout.trim()) {
            console.log(`直接执行openclaw --version成功: ${stdout.trim()}`);
            resolve(true);
          } else {
            resolve(false);
          }
        });

        timeout = setTimeout(() => {
          console.log(`openclaw --version命令超时`);
          if (childProcess && childProcess.kill) {
            childProcess.kill();
          }
          resolve(false);
        }, 5000);
      } catch (err) {
        console.log(`openclaw --version命令异常: ${err.message}`);
        if (timeout) clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  async checkOpenClawViaNpmList() {
    return new Promise((resolve) => {
      let timeout;
      let childProcess;

      try {
        childProcess = exec('npm list -g openclaw', { timeout: 5000 }, (error, stdout) => {
          if (timeout) clearTimeout(timeout);
          if (!error && stdout.includes('openclaw@')) {
            console.log(`通过npm list找到OpenClaw: ${stdout.trim()}`);
            resolve(true);
          } else {
            resolve(false);
          }
        });

        timeout = setTimeout(() => {
          if (childProcess && childProcess.kill) {
            childProcess.kill();
          }
          resolve(false);
        }, 5000);
      } catch (err) {
        if (timeout) clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  async getOpenClawVersion() {
    return new Promise((resolve) => {
      let timeout;
      let childProcess;

      try {
        childProcess = exec('openclaw --version', { timeout: 5000 }, (error, stdout) => {
          if (timeout) clearTimeout(timeout);
          resolve(error ? null : stdout.trim());
        });

        timeout = setTimeout(() => {
          if (childProcess && childProcess.kill) {
            childProcess.kill();
          }
          resolve(null);
        }, 5000);
      } catch (err) {
        if (timeout) clearTimeout(timeout);
        resolve(null);
      }
    });
  }

  async checkOpenClawRunning() {
    return new Promise((resolve) => {
      let timeout;
      let childProcess;

      try {
        childProcess = exec('netstat -ano | findstr :18789', { timeout: 3000 }, (error, stdout, stderr) => {
          if (timeout) clearTimeout(timeout);
          
          const output = (stdout + stderr).trim();
          const isPortInUse = output.includes('LISTENING') || output.includes('ESTABLISHED');
          
          console.log(`端口18789检测结果: ${output}`);
          console.log(`端口18789是否被占用: ${isPortInUse}`);

          resolve({
            running: isPortInUse,
            consoleUrl: isPortInUse ? 'http://127.0.0.1:18789/' : null,
            output: output
          });
        });

        timeout = setTimeout(() => {
          if (childProcess && childProcess.kill) {
            childProcess.kill();
          }
          resolve({
            running: false,
            consoleUrl: null,
            output: '端口检测超时'
          });
        }, 3000);
      } catch (err) {
        if (timeout) clearTimeout(timeout);
        resolve({
          running: false,
          consoleUrl: null,
          output: err.message
        });
      }
    });
  }

  async getServicesStatus() {
    return new Promise((resolve) => {
      const services = [];
      let timeout;
      let childProcess;

      try {
        childProcess = exec('openclaw doctor', { timeout: 3000 }, (error, stdout, stderr) => {
          if (timeout) clearTimeout(timeout);
          if (error) {
            services.push({
              name: 'OpenClaw Doctor',
              status: 'error',
              message: error.message
            });
          } else {
            services.push({
              name: 'OpenClaw Doctor',
              status: 'success',
              message: '配置正常'
            });
          }

          resolve(services);
        });

        timeout = setTimeout(() => {
          if (childProcess && childProcess.kill) {
            childProcess.kill();
          }
          services.push({
            name: 'OpenClaw Doctor',
            status: 'error',
            message: '命令执行超时'
          });
          resolve(services);
        }, 3000);
      } catch (err) {
        if (timeout) clearTimeout(timeout);
        services.push({
          name: 'OpenClaw Doctor',
          status: 'error',
          message: '命令执行失败'
        });
        resolve(services);
      }
    });
  }

  async restartOpenClaw(req, res) {
    try {
      const { action } = req.body;

      if (this.openclawOperation.inProgress) {
        return res.status(400).json({
          success: false,
          message: `OpenClaw正在${this.openclawOperation.action}中，请稍后再试`
        });
      }

      let command;
      let actionName;
      let args = [];

      if (action === 'restart') {
        command = 'openclaw';
        args = ['gateway', '--force'];
        actionName = '重启';
      } else if (action === 'stop') {
        command = 'taskkill';
        args = ['/F', '/IM', 'openclaw.exe'];
        actionName = '停止';
      } else if (action === 'start') {
        command = 'openclaw';
        args = ['gateway'];
        actionName = '启动';
      } else {
        return res.status(400).json({
          success: false,
          message: '无效的操作'
        });
      }

      this.openclawOperation = {
        inProgress: true,
        action: actionName,
        startTime: Date.now(),
        progress: [],
        error: null,
        success: null
      };

      console.log(`开始${actionName}OpenClaw...`);

      const output = await this.executeCommandWithProgress(command, args, (line) => {
        this.openclawOperation.progress.push({
          timestamp: Date.now(),
          content: line
        });
      });

      this.openclawOperation.success = true;
      this.openclawOperation.inProgress = false;
      this.openclawOperation.progress.push({
        timestamp: Date.now(),
        content: `${actionName}完成`
      });

      await this.logSuccess(req, 'restartOpenClaw', `OpenClaw ${actionName}成功`, { action, actionName, output: output.fullOutput });

      res.json({
        success: true,
        message: `OpenClaw ${actionName}成功`,
        output: output.fullOutput,
        progress: output.lines
      });
    } catch (error) {
      this.openclawOperation.error = error.message;
      this.openclawOperation.inProgress = false;
      this.openclawOperation.progress.push({
        timestamp: Date.now(),
        content: `错误: ${error.message}`
      });
      
      await this.logError(req, 'restartOpenClaw', error);
      res.status(500).json({
        success: false,
        message: `OpenClaw操作失败: ${error.message}`
      });
    }
  }

  async getOpenClawOperationProgress(req, res) {
    res.json({
      success: true,
      data: this.openclawOperation
    });
  }

  async getOpenClawLogs(req, res) {
    return new Promise((resolve) => {
      const { limit = 50 } = req.query;
      let timeout;
      let childProcess;
      let isResolved = false;

      try {
        const command = `openclaw logs --limit ${limit} --plain`;
        console.log(`获取OpenClaw日志: ${command}`);

        childProcess = exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
          if (isResolved) return;
          if (timeout) clearTimeout(timeout);

          const logs = (stdout + stderr).trim().split('\n').filter(line => line.trim());
          
          console.log(`获取到${logs.length}条OpenClaw日志`);

          isResolved = true;
          resolve(res.json({
            success: true,
            data: logs
          }));
        });

        timeout = setTimeout(() => {
          if (isResolved) return;
          console.log(`获取OpenClaw日志超时`);
          if (childProcess && childProcess.kill) {
            childProcess.kill();
          }
          isResolved = true;
          resolve(res.json({
            success: false,
            message: '获取日志超时',
            data: []
          }));
        }, 10000);
      } catch (err) {
        if (isResolved) return;
        console.log(`获取OpenClaw日志异常: ${err.message}`);
        if (timeout) clearTimeout(timeout);
        isResolved = true;
        resolve(res.json({
          success: false,
          message: err.message,
          data: []
        }));
      }
    });
  }

  async getNodeProcessesDetails(req, res) {
    return new Promise((resolve) => {
      const command = 'wmic process where "name=\'node.exe\'" get ProcessId,ParentProcessId,CommandLine /format:csv';
      let timeout;
      let childProcess;
      let isResolved = false;

      try {
        childProcess = exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
          if (isResolved) return;
          if (timeout) clearTimeout(timeout);

          const nodeProcesses = [];
          const lines = stdout.trim().split('\n');

          lines.forEach(line => {
            if (line.includes('openclaw') && !line.includes('Node,CommandLine')) {
              const parts = line.split(',').map(p => p.replace(/"/g, '').trim());
              if (parts.length >= 4) {
                const nodeId = parts[0];
                const commandLine = parts[1];
                const parentPid = parts[2];
                const pid = parts[3];
                
                if (commandLine.includes('openclaw')) {
                  nodeProcesses.push({
                    pid: pid,
                    name: 'node.exe',
                    parentPid: parentPid,
                    commandLine: commandLine,
                    isOpenClaw: true
                  });
                }
              }
            }
          });

          console.log(`检测到${nodeProcesses.length}个OpenClaw相关Node.js进程`);

          isResolved = true;
          resolve(res.json({
            success: true,
            data: nodeProcesses,
            count: nodeProcesses.length
          }));
        });

        timeout = setTimeout(() => {
          if (isResolved) return;
          console.log(`获取Node.js进程详情超时`);
          if (childProcess && childProcess.kill) {
            childProcess.kill();
          }
          isResolved = true;
          resolve(res.json({
            success: false,
            message: '获取进程超时',
            data: [],
            count: 0
          }));
        }, 5000);
      } catch (err) {
        if (isResolved) return;
        console.log(`获取Node.js进程详情异常: ${err.message}`);
        if (timeout) clearTimeout(timeout);
        isResolved = true;
        resolve(res.json({
          success: false,
          message: err.message,
          data: [],
          count: 0
        }));
      }
    });
  }

  executeCommandWithProgress(command, args = [], progressCallback = null) {
    return new Promise((resolve, reject) => {
      const lines = [];
      let fullOutput = '';
      let child = null;
      let timeoutId = null;
      let isResolved = false;
      
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (child && !child.killed) {
          console.log(`[${command}] 清理进程 PID: ${child.pid}`);
          try {
            child.kill('SIGTERM');
            setTimeout(() => {
              if (child && !child.killed) {
                child.kill('SIGKILL');
              }
            }, 1000);
          } catch (err) {
            console.error(`[${command}] 终止进程失败:`, err);
          }
        }
      };

      const resolveOnce = (result) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve(result);
        }
      };

      const rejectOnce = (error) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          reject(error);
        }
      };

      try {
        child = spawn(command, args, {
          shell: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        console.log(`[${command}] 启动进程 PID: ${child.pid}`);

        child.stdout.on('data', (data) => {
          const text = data.toString();
          fullOutput += text;
          const newLines = text.split('\n').filter(line => line.trim());
          lines.push(...newLines);
          console.log(`[${command}] ${text.trim()}`);
          
          if (progressCallback) {
            newLines.forEach(line => {
              progressCallback(line);
            });
          }
        });

        child.stderr.on('data', (data) => {
          const text = data.toString();
          fullOutput += text;
          const newLines = text.split('\n').filter(line => line.trim());
          lines.push(...newLines);
          console.error(`[${command}] ${text.trim()}`);
          
          if (progressCallback) {
            newLines.forEach(line => {
              progressCallback(line);
            });
          }
        });

        child.on('close', (code) => {
          console.log(`[${command}] 进程退出，代码: ${code}`);
          if (code === 0) {
            resolveOnce({ fullOutput, lines });
          } else {
            rejectOnce(new Error(`命令执行失败，退出代码: ${code}`));
          }
        });

        child.on('error', (error) => {
          console.error(`[${command}] 进程错误:`, error);
          rejectOnce(error);
        });

        timeoutId = setTimeout(() => {
          console.log(`[${command}] 超时，终止进程 PID: ${child.pid}`);
          rejectOnce(new Error('命令执行超时'));
        }, 30000);
      } catch (error) {
        rejectOnce(error);
      }
    });
  }

  async logSuccess(req, operation, content, metadata = {}) {
    try {
      const userId = req.user?.userId || null;
      const invitationCode = req.user?.invitationCode || null;
      const deviceId = req.user?.deviceId || null;

      await LogService.createLog(userId, {
        operation_stage: 'runtime',
        level: 'info',
        content,
        metadata: {
          operation,
          ...metadata,
          timestamp: new Date().toISOString()
        },
        invitation_code: invitationCode,
        device_id: deviceId
      });
    } catch (logError) {
      console.error('记录日志失败:', logError);
    }
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      let timeout;
      let childProcess;

      try {
        childProcess = exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
          if (timeout) clearTimeout(timeout);
          if (error) {
            reject(error);
          } else {
            resolve(stdout);
          }
        });

        timeout = setTimeout(() => {
          if (childProcess && childProcess.kill) {
            childProcess.kill();
          }
          reject(new Error('命令执行超时'));
        }, 30000);
      } catch (err) {
        if (timeout) clearTimeout(timeout);
        reject(err);
      }
    });
  }

  async getProcessLogs(req, res) {
    try {
      const { pid } = req.query;

      let command;
      if (os.platform() === 'win32') {
        command = pid 
          ? `tasklist /fi "PID eq ${pid}" /fo csv /v`
          : 'tasklist /fo csv /v';
      } else {
        command = pid 
          ? `ps -p ${pid} -o pid,ppid,cmd,%cpu,%mem`
          : 'ps aux';
      }

      exec(command, (error, stdout) => {
        if (error) {
          res.status(500).json({
            success: false,
            message: error.message
          });
        } else {
          res.json({
            success: true,
            data: {
              logs: stdout.trim(),
              timestamp: new Date().toISOString()
            }
          });
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getProcessDetails(req, res) {
    try {
      const { pid } = req.params;

      if (!pid) {
        return res.status(400).json({
          success: false,
          message: '进程ID不能为空'
        });
      }

      const details = await this.getProcessInfo(pid);

      res.json({
        success: true,
        data: details
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getProcessInfo(pid) {
    return new Promise((resolve) => {
      if (os.platform() !== 'win32') {
        resolve({
          pid,
          error: '仅支持Windows平台'
        });
        return;
      }

      const command = `wmic process where ProcessId=${pid} get ProcessId,Name,CommandLine,PageFileUsage,WorkingSetSize,UserModeTime,KernelModeTime /format:csv`;
      let timeout;
      let childProcess;

      try {
        childProcess = exec(command, { timeout: 3000 }, (error, stdout) => {
          if (timeout) clearTimeout(timeout);
          if (error) {
            resolve({
              pid,
              error: error.message,
              notFound: error.message.includes('No Instance')
            });
          } else {
            const lines = stdout.trim().split('\n').filter(line => line.trim());
            if (lines.length >= 2) {
              const parts = lines[1].split(',').map(p => p.replace(/"/g, '').trim());
              resolve({
                pid: parseInt(parts[0]),
                name: parts[1],
                commandLine: parts[2] || '',
                pageFileUsage: parts[3] || 'N/A',
                workingSetSize: parts[4] || 'N/A',
                userModeTime: parts[5] || 'N/A',
                kernelModeTime: parts[6] || 'N/A',
                memoryMB: parts[4] ? (parseInt(parts[4]) / 1024 / 1024).toFixed(2) : 'N/A',
                startTime: this.getProcessStartTime(pid)
              });
            } else {
              resolve({
                pid,
                error: '无法解析进程信息'
              });
            }
          }
        });

        timeout = setTimeout(() => {
          if (childProcess && childProcess.kill) {
            childProcess.kill();
          }
          resolve({
            pid,
            error: '查询超时'
          });
        }, 3000);
      } catch (err) {
        if (timeout) clearTimeout(timeout);
        resolve({
          pid,
          error: err.message
        });
      }
    });
  }

  async getProcessStartTime(pid) {
    return new Promise((resolve) => {
      const command = `wmic process where ProcessId=${pid} get CreationDate /format:csv`;
      let timeout;
      let childProcess;

      try {
        childProcess = exec(command, { timeout: 2000 }, (error, stdout) => {
          if (timeout) clearTimeout(timeout);
          if (error) {
            resolve('N/A');
          } else {
            const lines = stdout.trim().split('\n').filter(line => line.trim());
            if (lines.length >= 2) {
              const dateStr = lines[1].replace(/"/g, '').trim();
              try {
                const date = new Date(dateStr);
                resolve(date.toLocaleString('zh-CN'));
              } catch {
                resolve(dateStr);
              }
            } else {
              resolve('N/A');
            }
          }
        });

        timeout = setTimeout(() => {
          if (childProcess && childProcess.kill) {
            childProcess.kill();
          }
          resolve('N/A');
        }, 2000);
      } catch (err) {
        if (timeout) clearTimeout(timeout);
        resolve('N/A');
      }
    });
  }
}

module.exports = RuntimeMonitorController;