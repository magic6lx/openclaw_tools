const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: '134.175.18.139',
    port: 3306,
    user: 'root',
    password: 'root@126.com',
    database: 'openclaw_tools'
  });

  try {
    await pool.query('UPDATE invitations SET used_devices = 0');
    const [rows] = await pool.query('SELECT id, code, role, max_devices, used_devices, status FROM invitations ORDER BY id');
    console.log('After reset:');
    for (const row of rows) {
      console.log(`  id=${row.id} code=${row.code} role=${row.role} max=${row.max_devices} used=${row.used_devices} status=${row.status}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
