const { sequelize } = require('../src/config/database');
const { InvitationCode, User } = require('../src/models');
const InvitationCodeGenerator = require('../src/utils/InvitationCodeGenerator');

async function addRoleColumnAndCreateAdminCode() {
  try {
    console.log('连接数据库...');
    await sequelize.authenticate();
    console.log('数据库连接成功');

    console.log('\n添加 role 字段到 invitation_codes 表...');
    const queryInterface = sequelize.getQueryInterface();

    try {
      await queryInterface.addColumn('invitation_codes', 'role', {
        type: sequelize.Sequelize.ENUM('user', 'admin'),
        defaultValue: 'user',
        comment: '邀请码角色：user=普通用户, admin=管理员'
      });
      console.log('role 字段添加成功');
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('role 字段已存在，跳过');
      } else {
        throw err;
      }
    }

    console.log('\n创建管理员邀请码...');
    const code = InvitationCodeGenerator.generate();

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 12);

    const invitationCode = await InvitationCode.create({
      code,
      max_devices: 5,
      current_devices: 0,
      tokens_limit: 100000,
      tokens_used: 0,
      requests_limit: 100,
      requests_used: 0,
      expires_at: expiresAt,
      status: 'active',
      role: 'admin'
    });

    console.log('\n========================================');
    console.log('管理员邀请码创建成功！');
    console.log('========================================');
    console.log(`邀请码: ${invitationCode.code}`);
    console.log(`角色: ${invitationCode.role}`);
    console.log(`最大设备数: ${invitationCode.max_devices}`);
    console.log(`Token上限: ${invitationCode.tokens_limit}`);
    console.log(`过期时间: ${invitationCode.expires_at}`);
    console.log('========================================');
    console.log('\n使用此邀请码登录将获得管理员权限');

    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

addRoleColumnAndCreateAdminCode();
