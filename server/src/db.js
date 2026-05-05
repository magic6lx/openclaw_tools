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
  } catch (err) {
    console.error('❌ Schema init failed:', err.message);
  }
}

module.exports = {
  pool,
  query,
  getConnection,
  testConnection,
  initSchema
};
