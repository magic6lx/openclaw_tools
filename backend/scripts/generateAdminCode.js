require('dotenv').config({ path: '../config/.env' });
const { Sequelize } = require('sequelize');
const InvitationCodeService = require('../src/services/InvitationCodeService');

async function generateAdminCode() {
  let sequelize;
  
  try {
    console.log('正在连接到数据库...');
    console.log(`数据库: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
    
    sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql',
        logging: false
      }
    );
    
    await sequelize.authenticate();
    console.log('✓ 连接成功！');

    console.log('\n正在生成管理员邀请码...');
    
    const invitationCode = await InvitationCodeService.generateCode(100);

    console.log('\n✅ 管理员邀请码生成成功！');
    console.log('\n========================================');
    console.log(`邀请码: ${invitationCode.code}`);
    console.log(`最大设备数: ${invitationCode.max_devices}`);
    console.log(`状态: ${invitationCode.status}`);
    console.log('========================================');
    console.log('\n使用说明:');
    console.log('1. 打开前端应用: http://localhost:5173');
    console.log('2. 在登录页面输入上面的邀请码');
    console.log('3. 点击登录按钮');
    console.log('4. 登录成功后即可使用所有功能');
    
  } catch (error) {
    console.error('❌ 生成邀请码失败:', error.message);
    throw error;
  } finally {
    if (sequelize) {
      await sequelize.close();
    }
  }
}

generateAdminCode()
  .then(() => {
    console.log('\n✅ 完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n失败:', error.message);
    process.exit(1);
  });