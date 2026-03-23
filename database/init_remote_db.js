const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: '134.175.18.139',
  port: 3306,
  user: 'root',
  password: 'root@126.com',
  multipleStatements: true
};

async function initDatabase() {
  let connection;
  
  try {
    console.log('正在连接到MySQL服务器...');
    connection = await mysql.createConnection(dbConfig);
    console.log('连接成功！');

    console.log('\n正在读取SQL脚本...');
    const sqlPath = path.join(__dirname, 'init_remote.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('SQL脚本读取成功');

    console.log('\n正在执行SQL脚本...');
    await connection.query(sql);
    console.log('数据库初始化成功！');

    console.log('\n正在验证数据库...');
    const [databases] = await connection.query('SHOW DATABASES LIKE "openclaw_tools"');
    if (databases.length > 0) {
      console.log('✓ 数据库 openclaw_tools 创建成功');
    }

    const [tables] = await connection.query('SHOW TABLES FROM openclaw_tools');
    console.log(`✓ 创建了 ${tables.length} 个数据表:`);
    tables.forEach(table => {
      console.log(`  - ${Object.values(table)[0]}`);
    });

    console.log('\n数据库初始化完成！');
    
  } catch (error) {
    console.error('数据库初始化失败:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

initDatabase()
  .then(() => {
    console.log('\n✅ 所有操作完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 初始化失败:', error.message);
    process.exit(1);
  });