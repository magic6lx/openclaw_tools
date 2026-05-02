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
    const [rows] = await pool.query('SELECT id, code, role, max_devices, used_devices, status FROM invitations ORDER BY id');
    console.log('Before reset:');
    for (const row of rows) {
      console.log(`  id=${row.id} code=${row.code} role=${row.role} max=${row.max_devices} used=${row.used_devices} status=${row.status}`);
    }

    await pool.query('UPDATE invitations SET used_devices = 0 WHERE used_devices >= max_devices');
    await pool.query('UPDATE invitations SET max_devices = 999 WHERE role = "admin"');
    await pool.query('UPDATE invitations SET max_devices = 99 WHERE role = "user"');

    const [rows2] = await pool.query('SELECT id, code, role, max_devices, used_devices, status FROM invitations ORDER BY id');
    console.log('After reset:');
    for (const row of rows2) {
      console.log(`  id=${row.id} code=${row.code} role=${row.role} max=${row.max_devices} used=${row.used_devices} status=${row.status}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
