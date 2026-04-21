const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    console.log('正在测试MySQL连接...');
    console.log(`主机: 134.175.18.139`);
    console.log(`端口: 3306`);
    console.log(`用户: root`);
    
    const connection = await mysql.createConnection({
      host: '134.175.18.139',
      port: 3306,
      user: 'root',
      password: 'root@126.com'
    });
    
    console.log('✓ 连接成功！');
    
    const [rows] = await connection.query('SHOW DATABASES');
    console.log('\n可用数据库:');
    rows.forEach(row => {
      console.log(`  - ${Object.values(row)[0]}`);
    });
    
    await connection.end();
    console.log('\n✅ 测试完成！');
    
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
    console.error('错误代码:', error.code);
    console.error('错误详情:', error);
  }
}

testConnection();