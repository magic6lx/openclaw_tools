require('dotenv').config({ path: '../config/.env' });
const { Sequelize } = require('sequelize');

async function initDatabase() {
  let sequelize;
  
  try {
    console.log('正在连接到MySQL服务器...');
    console.log(`主机: ${process.env.DB_HOST}`);
    console.log(`端口: ${process.env.DB_PORT}`);
    console.log(`用户: ${process.env.DB_USER}`);
    
    sequelize = new Sequelize(
      null,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql',
        logging: console.log
      }
    );
    
    await sequelize.authenticate();
    console.log('✓ 连接成功！');

    console.log('\n正在创建数据库...');
    await sequelize.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✓ 数据库 ${process.env.DB_NAME} 创建成功`);

    await sequelize.close();
    
    console.log('\n正在连接到新创建的数据库...');
    sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql',
        logging: console.log,
        define: {
          timestamps: true,
          underscored: false,
          createdAt: 'created_at',
          updatedAt: 'updated_at'
        }
      }
    );
    
    await sequelize.authenticate();
    console.log('✓ 连接到数据库成功！');

    console.log('\n正在导入模型...');
    const User = require('../src/models/User');
    const InvitationCode = require('../src/models/InvitationCode');
    const ConfigTemplate = require('../src/models/ConfigTemplate');
    const UserConfig = require('../src/models/UserConfig');
    const Log = require('../src/models/Log');
    const TemplateReview = require('../src/models/TemplateReview');
    
    console.log('✓ 模型导入成功');

    console.log('\n正在创建数据表...');
    await sequelize.sync({ force: false, alter: true });
    console.log('✓ 所有数据表创建成功');

    const [results] = await sequelize.query('SHOW TABLES');
    console.log(`\n✓ 当前数据库包含 ${results.length} 个表:`);
    results.forEach(result => {
      console.log(`  - ${Object.values(result)[0]}`);
    });

    console.log('\n✅ 数据库初始化完成！');
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    console.error('详细错误:', error);
    throw error;
  } finally {
    if (sequelize) {
      await sequelize.close();
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
    console.error('\n初始化失败:', error.message);
    process.exit(1);
  });