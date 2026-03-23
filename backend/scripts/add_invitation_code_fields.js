/**
 * 添加邀请码表缺少的字段
 */

const { sequelize } = require('../src/config/database');

async function addFields() {
  try {
    console.log('开始添加字段...');

    // 检查并添加 api_key_id 字段
    try {
      await sequelize.query(`
        ALTER TABLE invitation_codes 
        ADD COLUMN api_key_id VARCHAR(100) NULL COMMENT '临时API密钥ID'
      `);
      console.log('✓ 添加 api_key_id 字段成功');
    } catch (e) {
      console.error('✗ 添加 api_key_id 失败:', e.message);
      console.error('  错误详情:', e.original?.message || e.message);
    }

    // 检查并添加 api_secret_key 字段
    try {
      await sequelize.query(`
        ALTER TABLE invitation_codes 
        ADD COLUMN api_secret_key VARCHAR(255) NULL COMMENT '临时API密钥Secret'
      `);
      console.log('✓ 添加 api_secret_key 字段成功');
    } catch (e) {
      console.error('✗ 添加 api_secret_key 失败:', e.message);
      console.error('  错误详情:', e.original?.message || e.message);
    }

    // 检查并添加 requests_used 字段
    try {
      await sequelize.query(`
        ALTER TABLE invitation_codes 
        ADD COLUMN requests_used INT DEFAULT 0 COMMENT '已使用的请求次数'
      `);
      console.log('✓ 添加 requests_used 字段成功');
    } catch (e) {
      console.error('✗ 添加 requests_used 失败:', e.message);
      console.error('  错误详情:', e.original?.message || e.message);
    }

    // 检查并添加 requests_limit 字段
    try {
      await sequelize.query(`
        ALTER TABLE invitation_codes 
        ADD COLUMN requests_limit INT DEFAULT 10 COMMENT '请求次数上限'
      `);
      console.log('✓ 添加 requests_limit 字段成功');
    } catch (e) {
      console.error('✗ 添加 requests_limit 失败:', e.message);
      console.error('  错误详情:', e.original?.message || e.message);
    }

    console.log('\n所有字段添加完成！');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error);
    process.exit(1);
  }
}

addFields();
