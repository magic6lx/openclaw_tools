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
  keepAliveInitialDelay: 0
});

async function query(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
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
