const { sequelize } = require('./src/config/database');
const { User, InvitationCode } = require('./src/models');

(async () => {
  try {
    console.log('检查数据库中的用户和邀请码...');
    
    const invitationCodes = await InvitationCode.findAll();
    console.log('\n邀请码列表:');
    invitationCodes.forEach(code => {
      console.log(`  代码: ${code.code}, 状态: ${code.status}, 最大设备: ${code.max_devices}, 当前设备: ${code.current_devices}`);
    });
    
    const users = await User.findAll({ include: [InvitationCode] });
    console.log('\n用户列表:');
    if (users.length === 0) {
      console.log('  暂无用户');
    } else {
      users.forEach(user => {
        console.log(`  用户ID: ${user.id}, 设备ID: ${user.device_id}, 邀请码: ${user.InvitationCode ? user.InvitationCode.code : 'N/A'}`);
      });
    }
  } catch (e) {
    console.error('错误:', e.message);
  } finally {
    await sequelize.close();
  }
})();