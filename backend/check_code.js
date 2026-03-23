const { sequelize } = require('./src/config/database');
const { InvitationCode } = require('./src/models');

(async () => {
  try {
    console.log('检查邀请码 HGKDBQUSUAJ...');
    
    const code = await InvitationCode.findOne({ where: { code: 'HGKDBQUSUAJ' } });
    
    if (code) {
      console.log('邀请码存在:');
      console.log(`  代码: ${code.code}`);
      console.log(`  状态: ${code.status}`);
      console.log(`  最大设备: ${code.max_devices}`);
      console.log(`  当前设备: ${code.current_devices}`);
    } else {
      console.log('邀请码不存在，正在创建...');
      
      const newCode = await InvitationCode.create({
        code: 'HGKDBQUSUAJ',
        max_devices: 10,
        current_devices: 0,
        status: 'active'
      });
      
      console.log('邀请码创建成功:');
      console.log(`  代码: ${newCode.code}`);
      console.log(`  状态: ${newCode.status}`);
    }
  } catch (e) {
    console.error('错误:', e.message);
  } finally {
    await sequelize.close();
  }
})();