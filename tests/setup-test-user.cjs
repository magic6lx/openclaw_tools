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
    const [admins] = await pool.query("SELECT code, role, status FROM invitations WHERE role = 'admin' LIMIT 1");
    if (admins.length > 0) {
      console.log('ADMIN_CODE=' + admins[0].code);
    } else {
      const crypto = require('crypto');
      const code = 'E2ETEST' + crypto.randomBytes(3).toString('hex').toUpperCase();
      await pool.query(
        'INSERT INTO invitations (code, role, max_devices, used_devices, status) VALUES (?, ?, ?, ?, ?)',
        [code, 'admin', 999, 0, 'active']
      );
      console.log('ADMIN_CODE=' + code);
    }

    const [users] = await pool.query("SELECT code, role, status FROM invitations WHERE role = 'user' AND status = 'active' LIMIT 1");
    if (users.length > 0) {
      console.log('USER_CODE=' + users[0].code);
    } else {
      const crypto = require('crypto');
      const code = 'E2EUSER' + crypto.randomBytes(3).toString('hex').toUpperCase();
      await pool.query(
        'INSERT INTO invitations (code, role, max_devices, used_devices, status) VALUES (?, ?, ?, ?, ?)',
        [code, 'user', 999, 0, 'active']
      );
      console.log('USER_CODE=' + code);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
