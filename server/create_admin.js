const mysql = require('mysql2/promise');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  const pool = mysql.createPool({
    host: '134.175.18.139',
    port: 3306,
    user: 'root',
    password: 'root@126.com',
    multipleStatements: true // 允许执行多条SQL语句
  });

  try {
    console.log('Reading init-db.sql...');
    const sqlScript = fs.readFileSync(path.join(__dirname, 'scripts', 'init-db.sql'), 'utf8');

    console.log('Executing database initialization script...');
    await pool.query(sqlScript);
    console.log('Database initialized successfully.');

    // 切换到正确的数据库
    await pool.query('USE openclaw_tools;');

    const code = crypto.randomBytes(4).toString('hex').toUpperCase();

    const [admins] = await pool.query("SELECT code FROM invitations WHERE role = 'admin'");
    
    if (admins.length > 0) {
      console.log('An admin code already exists in the database:');
      console.log('====================================');
      console.log('         ' + admins[0].code);
      console.log('====================================');
      console.log('You can use this code to login.');
    } else {
      await pool.query(
        'INSERT INTO invitations (code, role, max_devices, used_devices, status) VALUES (?, ?, ?, ?, ?)',
        [code, 'admin', 999, 0, 'active']
      );
      console.log('Successfully created NEW admin invitation code:');
      console.log('====================================');
      console.log('         ' + code);
      console.log('====================================');
      console.log('Please save this code to login.');
    }
  } catch (err) {
    console.error('Error during setup:', err.message);
  } finally {
    await pool.end();
  }
}

setupDatabase();