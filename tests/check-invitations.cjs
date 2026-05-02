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
    console.log(JSON.stringify(rows, null, 2));

    for (const row of rows) {
      if (row.used_devices >= row.max_devices) {
        await pool.query('UPDATE invitations SET used_devices = 0 WHERE id = ?', [row.id]);
        console.log(`Reset used_devices for id=${row.id} code=${row.code}`);
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
