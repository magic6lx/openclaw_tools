const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '134.175.18.139',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root@126.com',
  database: process.env.DB_NAME || 'openclaw_tools',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  idleTimeout: 60000,
  maxIdle: 5
});

async function query(sql, params, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const [rows] = await pool.execute(sql, params);
      return rows;
    } catch (err) {
      if ((err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ETIMEDOUT') && attempt < retries) {
        console.warn(`DB query retry ${attempt}/${retries} for error: ${err.code}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      throw err;
    }
  }
}

async function getConnection() {
  return await pool.getConnection();
}

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('✅ Database connected successfully');
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    return false;
  }
}

async function initSchema() {
  try {
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invitations' AND COLUMN_NAME = 'token_proxy'
    `);
    if (columns.length > 0) {
      console.log('ℹ️ Schema already up to date: token_proxy column exists');
    } else {
      await pool.execute(`ALTER TABLE invitations ADD COLUMN token_proxy JSON DEFAULT NULL`);
      console.log('✅ Schema initialized: token_proxy column added');
    }

    // Add file_payload column to templates table if it doesn't exist
    const [templateColumns] = await pool.execute(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'file_payload'
    `);
    if (templateColumns.length > 0) {
      console.log('ℹ️ Schema already up to date: file_payload column exists in templates table');
    } else {
      await pool.execute(`ALTER TABLE templates ADD COLUMN file_payload LONGTEXT DEFAULT NULL`);
      console.log('✅ Schema initialized: file_payload column added to templates table');
    }

    // Add config_content column to templates table if it doesn't exist
    const [configContentColumns] = await pool.execute(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'config_content'
    `);
    if (configContentColumns.length > 0) {
      console.log('ℹ️ Schema already up to date: config_content column exists in templates table');
    } else {
      await pool.execute(`ALTER TABLE templates ADD COLUMN config_content LONGTEXT DEFAULT NULL`);
      console.log('✅ Schema initialized: config_content column added to templates table');
    }

    // Add env column to templates table if it doesn't exist
    const [envColumns] = await pool.execute(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'env'
    `);
    if (envColumns.length > 0) {
      console.log('ℹ️ Schema already up to date: env column exists in templates table');
    } else {
      await pool.execute(`ALTER TABLE templates ADD COLUMN env LONGTEXT DEFAULT NULL`);
      console.log('✅ Schema initialized: env column added to templates table');
    }

    // Add manifest column to templates table if it doesn't exist
    const [manifestColumns] = await pool.execute(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'manifest'
    `);
    if (manifestColumns.length > 0) {
      console.log('ℹ️ Schema already up to date: manifest column exists in templates table');
    } else {
      await pool.execute(`ALTER TABLE templates ADD COLUMN manifest LONGTEXT DEFAULT NULL`);
      console.log('✅ Schema initialized: manifest column added to templates table');
    }

    // Add file_list column to templates table if it doesn't exist
    const [fileListColumns] = await pool.execute(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'file_list'
    `);
    if (fileListColumns.length > 0) {
      console.log('ℹ️ Schema already up to date: file_list column exists in templates table');
    } else {
      await pool.execute(`ALTER TABLE templates ADD COLUMN file_list LONGTEXT DEFAULT NULL`);
      console.log('✅ Schema initialized: file_list column added to templates table');
    }

    // Add config_migration column to templates table if it doesn't exist
    const [configMigrationColumns] = await pool.execute(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'templates' AND COLUMN_NAME = 'config_migration'
    `);
    if (configMigrationColumns.length > 0) {
      console.log('ℹ️ Schema already up to date: config_migration column exists in templates table');
    } else {
      await pool.execute(`ALTER TABLE templates ADD COLUMN config_migration LONGTEXT DEFAULT NULL`);
      console.log('✅ Schema initialized: config_migration column added to templates table');
    }

    // Add invitation_id column to logs table if it doesn't exist
    const [logColumns] = await pool.execute(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'logs' AND COLUMN_NAME = 'invitation_id'
    `);
    if (logColumns.length > 0) {
      console.log('ℹ️ Schema already up to date: invitation_id column exists in logs table');
    } else {
      await pool.execute(`ALTER TABLE logs ADD COLUMN invitation_id INT DEFAULT NULL`);
      console.log('✅ Schema initialized: invitation_id column added to logs table');
    }

    // Create devices table if it doesn't exist and add invitation_id and last_seen columns
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS devices (
        device_id VARCHAR(255) PRIMARY KEY,
        invitation_id INT DEFAULT NULL,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Schema initialized: devices table ensured with invitation_id and last_seen');

    // Add invitation_id column to devices table if it doesn't exist
    const [deviceInvitationIdColumns] = await pool.execute(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'devices' AND COLUMN_NAME = 'invitation_id'
    `);
    if (deviceInvitationIdColumns.length === 0) {
      await pool.execute(`ALTER TABLE devices ADD COLUMN invitation_id INT DEFAULT NULL AFTER device_id`);
      await pool.execute(`ALTER TABLE devices ADD CONSTRAINT fk_device_invitation FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE SET NULL`);
      console.log('✅ Schema updated: invitation_id column and foreign key added to devices table');
    }

    // Add last_seen column to devices table if it doesn't exist
    const [deviceLastSeenColumns] = await pool.execute(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'devices' AND COLUMN_NAME = 'last_seen'
    `);
    if (deviceLastSeenColumns.length === 0) {
      await pool.execute(`ALTER TABLE devices ADD COLUMN last_seen DATETIME DEFAULT CURRENT_TIMESTAMP`);
      console.log('✅ Schema updated: last_seen column added to devices table');
    }

    // Create system_config table if it doesn't exist
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS system_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(64) NOT NULL COMMENT '规则分类：manifest/migration/system',
        name VARCHAR(128) NOT NULL COMMENT '规则名称',
        value JSON NOT NULL COMMENT '规则内容',
        description VARCHAR(512) DEFAULT NULL COMMENT '规则说明',
        is_active BOOLEAN DEFAULT TRUE,
        version VARCHAR(32) DEFAULT '1.0',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_category_name (category, name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Schema initialized: system_config table ensured');

    // Seed default rules if table is empty
    const [existingRules] = await pool.execute('SELECT COUNT(*) as cnt FROM system_config');
    if (existingRules[0].cnt === 0) {
      await seedSystemConfig(pool);
      console.log('✅ System config rules seeded');
    }
  } catch (err) {
    console.error('❌ Schema init failed:', err.message);
  }
}

async function seedSystemConfig(pool) {
  const defaults = [
    // manifest 层规则
    {
      category: 'manifest',
      name: 'DEFAULT_TEMPLATE_MANIFEST',
      value: {
        bundleDirs: ['workspace', 'skills'],
        normalizePaths: {
          'agents.defaults.workspace': 'workspace',
          'logging.file': 'logs/openclaw.log'
        }
      },
      description: '默认 Manifest 模板，用于模板导出时的同步清单生成基准'
    },
    {
      category: 'manifest',
      name: 'EXCLUDED_PATTERNS',
      value: ['.git', '.gitignore', '.gitattributes', 'node_modules', '.DS_Store', 'Thumbs.db', 'sessions', '.jsonl', '.deleted.', '.session', '.bak', '.bak.', '.clobbered.', '.fixed', '手动备份'],
      description: '文件发现时排除的文件名模式'
    },
    {
      category: 'manifest',
      name: 'DEFAULT_EXCLUDED_DIRS',
      value: ['credentials', 'logs', 'bin', 'tools', 'private_templates', 'manifests', 'snapshots', 'apply_records'],
      description: '文件发现时默认排除的目录名'
    },
    {
      category: 'manifest',
      name: 'FORCE_EXCLUDED_DIRS',
      value: ['credentials'],
      description: '强制排除的目录名，无论如何都不参与同步'
    },

    // migration 层规则
    {
      category: 'migration',
      name: 'PATH_ADAPTATION_RULES',
      value: {
        pathFields: ['workspace', 'agentDir', 'path', 'dir', 'logging.file'],
        sensitiveFields: ['apiKey', 'api_key', 'token', 'secret', 'password', 'privateKey'],
        keepExistingFields: ['models', 'agents'],
        mappings: {
          'workspace': { target: 'joinConfigDir', args: ['workspace'] },
          'logging.file': { target: 'joinConfigDir', args: ['logs', 'openclaw.log'] },
          '_default': { target: 'joinConfigDir' }
        }
      },
      description: '路径适配规则，决定哪些字段作为路径处理及如何水合'
    },
    {
      category: 'migration',
      name: 'PROXY_RULES',
      value: {
        providers: ['volcengine', 'openai', 'anthropic', 'google'],
        enable: {
          openclawJson: { 'models.useProxy': { op: 'value', value: true } },
          providerOps: [
            { path: 'baseUrl', backupTo: '_originalBaseUrl' },
            { path: 'apiKey', backupTo: '_originalApiKey' },
            { path: 'baseUrl', op: 'value', value: '{{serverUrl}}/api/proxy/{{providerName}}' },
            { path: 'apiKey', op: 'value', value: '{{userToken}}' },
            { path: 'api', op: 'value', value: 'openai-completions' }
          ],
          authProfiles: { 'profiles': { op: 'backup', to: '_originalProfiles' } },
          authProfileKey: { op: 'value', value: '{{userToken}}' },
          agentModels: { 'providers': { op: 'backup', to: '_originalProviders' } }
        },
        disable: {
          openclawJson: { 'models.useProxy': null },
          providerOps: [
            { path: 'baseUrl', restoreFrom: '_originalBaseUrl' },
            { path: 'apiKey', restoreFrom: '_originalApiKey' },
            { path: '_originalBaseUrl', op: 'delete' },
            { path: '_originalApiKey', op: 'delete' },
            { path: 'api', op: 'delete', ifValue: 'openai-completions' }
          ],
          removeEmptyProviders: true,
          authProfiles: { 'profiles': { op: 'restore', from: '_originalProfiles' }, '_originalProfiles': null },
          agentModels: { 'providers': { op: 'restore', from: '_originalProviders' }, '_originalProviders': null }
        }
      },
      description: '代理开关规则，定义启用/关闭代理时的配置变换操作'
    },
    {
      category: 'migration',
      name: 'MODEL_PROVIDER_MAP',
      value: {
        'gpt-4': 'openai', 'gpt-4-turbo': 'openai', 'gpt-4o': 'openai', 'gpt-3.5-turbo': 'openai',
        'claude-3-opus': 'anthropic', 'claude-3-sonnet': 'anthropic', 'claude-3-haiku': 'anthropic', 'claude-2': 'anthropic',
        'gemini-pro': 'google', 'gemini-1.5-pro': 'google',
        'doubao': 'volcengine', 'doubao-seed': 'volcengine'
      },
      description: '模型名到 provider 名的映射，用于代理时查找对应配置'
    },
    {
      category: 'migration',
      name: 'PROVIDER_API_BASE',
      value: {
        'openai': 'https://api.openai.com/v1',
        'anthropic': 'https://api.anthropic.com/v1',
        'google': 'https://generativelanguage.googleapis.com/v1beta',
        'volcengine': 'https://ark.cn-beijing.volces.com/api/v3'
      },
      description: '各 provider 的原始 API 端点，关闭代理时恢复用'
    },
    {
      category: 'migration',
      name: 'CUSTOM_TRANSFORMS',
      value: {},
      description: '自定义变换函数（JSON 格式），键为函数名，值为函数体字符串'
    },

    // system 层规则
    {
      category: 'system',
      name: 'ALLOWED_CLI_COMMANDS',
      value: ['openclaw channels login --channel feishu', 'openclaw devices approve', 'openclaw doctor'],
      description: '允许客户端执行的 openclaw CLI 命令'
    }
  ];

  for (const rule of defaults) {
    await pool.execute(
      'INSERT INTO system_config (category, name, value, description) VALUES (?, ?, ?, ?)',
      [rule.category, rule.name, JSON.stringify(rule.value), rule.description]
    );
  }
}

module.exports = {
  pool,
  query,
  getConnection,
  testConnection,
  initSchema
};
