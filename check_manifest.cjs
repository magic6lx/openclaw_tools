const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: '134.175.18.139',
    port: 3306,
    user: 'root',
    password: 'root@126.com',
    database: 'openclaw_tools'
  });

  const [rows] = await conn.query('SELECT id, category, name, value FROM system_config WHERE category = "manifest"');
  console.log('Manifest rules:', JSON.stringify(rows, null, 2));

  await conn.end();
}

main().catch(console.error);
