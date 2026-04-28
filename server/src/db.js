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
    await pool.execute(`
      ALTER TABLE invitations
      ADD COLUMN IF NOT EXISTS token_proxy JSON DEFAULT NULL
    `);
    console.log('✅ Schema initialized: token_proxy column added');
  } catch (err) {
    if (err.message.includes('Duplicate column')) {
      console.log('ℹ️ Schema already up to date');
    } else {
      console.error('❌ Schema init failed:', err.message);
    }
  }
}

module.exports = {
  pool,
  query,
  getConnection,
  testConnection,
  initSchema
};
