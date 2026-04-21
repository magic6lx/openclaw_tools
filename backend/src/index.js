const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

dotenv.config({ path: '.env' });
dotenv.config({ path: '../config/.env' });

const { testConnection, syncDatabase } = require('./config/database');
const invitationCodesRouter = require('./routes/invitationCodes');
const authRouter = require('./routes/auth');
const configTemplatesRouter = require('./routes/configTemplates');
const recommendationsRouter = require('./routes/recommendations');
const userConfigsRouter = require('./routes/userConfigs');
const logsRouter = require('./routes/logs');
const configValidatorRouter = require('./routes/configValidator');
const usersRouter = require('./routes/users');
const localConfigRouter = require('./routes/local-config');
const openclawInstallRouter = require('./routes/openclawInstall');
const runtimeMonitorRouter = require('./routes/runtimeMonitor');
const clientMonitorRouter = require('./routes/clientMonitor');
const launcherLogsRouter = require('./routes/launcherLogs');
const launcherRouter = require('./routes/launcher');
const apiProxyRouter = require('./routes/apiProxy');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../../frontend/public')));

const PORT = process.env.PORT || 3002;

app.use('/api/invitation-codes', invitationCodesRouter);
app.use('/api/auth', authRouter);
app.use('/api/config-templates', configTemplatesRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/user-configs', userConfigsRouter);
app.use('/api/logs', logsRouter);
app.use('/api/config-validator', configValidatorRouter);
app.use('/api/users', usersRouter);
app.use('/api/local-config', localConfigRouter);
app.use('/api/openclaw-install', openclawInstallRouter);
app.use('/api/runtime-monitor', runtimeMonitorRouter);
app.use('/api/client-monitor', clientMonitorRouter);
app.use('/api/launcher-logs', launcherLogsRouter);
app.use('/api/launcher', launcherRouter);
app.use('/api/proxy', apiProxyRouter);

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OpenClaw智能配置系统API',
      version: '1.0.0',
      description: 'OpenClaw智能配置系统后端API文档'
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: '开发服务器'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.get('/', (req, res) => {
  res.json({
    message: 'OpenClaw智能配置系统API',
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

app.get('/api/launcher-check', async (req, res) => {
  try {
    const { execSync } = require('child_process');
    const currentVersion = execSync('npm list -g openclaw-launcher --depth=0 2>/dev/null || npm list -g electron --depth=0 2>/dev/null || echo "unknown"', { encoding: 'utf8' });
    
    let localVersion = 'unknown';
    const match = currentVersion.match(/(openclaw-launcher|electron)@(\d+\.\d+\.\d+)/);
    if (match) {
      localVersion = match[2];
    }

    res.json({
      success: true,
      version: localVersion,
      latestVersion: localVersion,
      needsUpdate: false,
      downloadUrl: '/OpenClaw-Launcher-v1.0.3.exe'
    });
  } catch (error) {
    res.json({
      success: true,
      version: '1.0.0',
      latestVersion: '1.0.0',
      needsUpdate: false,
      downloadUrl: '/OpenClaw-Launcher-v1.0.3.exe'
    });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: '服务器内部错误',
    message: err.message
  });
});

const startServer = async () => {
  try {
    await testConnection();
    // await syncDatabase(); // 临时禁用自动同步，避免索引限制错误
    
    const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '0.0.0.0';
    app.listen(PORT, HOST, () => {
      console.log(`服务器运行在端口 ${PORT}`);
      console.log(`API文档: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;