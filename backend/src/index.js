const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
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
const apiProxyRouter = require('./routes/apiProxy');

const app = express();

app.use(cors({
  origin: ['http://134.175.18.139:3001', 'http://134.175.18.139:3002'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 3000;

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
    
    app.listen(PORT, () => {
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