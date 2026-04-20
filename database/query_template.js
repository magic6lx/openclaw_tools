const mysql = require('mysql2/promise');

async function query() {
  const connection = await mysql.createConnection({
    host: '134.175.18.139',
    port: 3306,
    user: 'openclaw_user',
    password: 'openclaw_pass123',
    database: 'openclaw_config'
  });

  const [rows] = await connection.execute(
    "SELECT id, name, category, JSON_KEYS(config_content) as keys FROM config_templates WHERE name LIKE '%技能%' OR name LIKE '%v1%'"
  );

  console.log(JSON.stringify(rows, null, 2));
  await connection.end();
}

query().catch(console.error);
