const { sequelize } = require('./src/config/database');
const { User, InvitationCode } = require('./src/models');

(async () => {
  try {
    console.log('设置管理员用户...');
    
    const code = await InvitationCode.findOne({ where: { code: 'HGKDBQUSUAJ' } });
    
    if (!code) {
      console.log('邀请码不存在，正在创建...');
      code = await InvitationCode.create({
        code: 'HGKDBQUSUAJ',
        max_devices: 10,
        current_devices: 0,
        status: 'active'
      });
      console.log('邀请码创建成功');
    }
    
    const deviceId = 'admin-device-' + Date.now();
    
    const adminUser = await User.create({
      invitation_code_id: code.id,
      device_id: deviceId,
      device_name: '管理员设备',
      os_type: 'Windows',
      os_version: '10',
      hardware_info: '管理员设备',
      role: 'admin',
      status: 'active',
      last_login_at: new Date()
    });
    
    await code.update({
      current_devices: code.current_devices + 1
    });
    
    console.log('\n管理员用户创建成功！');
    console.log('登录信息:');
    console.log(`  邀请码: HGKDBQUSUAJ`);
    console.log(`  设备ID: ${deviceId}`);
    console.log(`  角色: admin`);
    console.log(`  用户ID: ${adminUser.id}`);
    
    console.log('\n请使用邀请码 HGKDBQUSUAJ 登录，系统会自动识别为管理员');
    
  } catch (e) {
    console.error('错误:', e.message);
    console.error('详细错误:', e);
  } finally {
    await sequelize.close();
  }
})();