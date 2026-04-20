const mysql = require('mysql2/promise');

async function query() {
  const connection = await mysql.createConnection({
    host: '134.175.18.139',
    port: 3306,
    user: 'root',
    password: 'root@126.com',
    database: 'openclaw_tools'
  });

  const [rows] = await connection.execute(
    "SELECT config_content FROM config_templates WHERE id = 1"
  );

  if (rows[0]) {
    const content = rows[0].config_content;
    
    console.log('=== Template Structure ===');
    console.log('Keys:', Object.keys(content));
    
    if (content.meta) {
      console.log('\n=== Meta ===');
      console.log(JSON.stringify(content.meta, null, 2));
    }
    
    if (content.configs) {
      console.log('\n=== Configs._meta ===');
      console.log(JSON.stringify(content.configs._meta, null, 2));
    }
    
    console.log('\n=== Summary ===');
    if (content.files) {
      console.log('Files count:', content.files.length);
      const filePaths = content.files.map(f => f.filePath);
      console.log('File paths:', filePaths);
    }
  }
  
  await connection.end();
}

query().catch(console.error);
