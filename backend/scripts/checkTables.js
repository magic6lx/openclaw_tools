const mysql = require('mysql2/promise');

async function checkTables() {
  try {
    console.log('正在检查数据库表...');
    
    const connection = await mysql.createConnection({
      host: '134.175.18.139',
      port: 3306,
      user: 'root',
      password: 'root@126.com',
      database: 'openclaw_tools'
    });
    
    console.log('✓ 连接成功！');
    
    const [rows] = await connection.query('SHOW TABLES');
    console.log(`\n数据库 openclaw_tools 包含 ${rows.length} 个表:`);
    if (rows.length > 0) {
      rows.forEach(row => {
        console.log(`  - ${Object.values(row)[0]}`);
      });
    } else {
      console.log('  (空)');
    }
    
    await connection.end();
    console.log('\n✅ 检查完成！');
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  }
}

checkTables();