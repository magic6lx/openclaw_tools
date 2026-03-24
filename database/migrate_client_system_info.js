const { sequelize } = require('../src/config/database');

async function migrate() {
  try {
    console.log('开始创建 client_system_info 表...');

    const sql = `
    CREATE TABLE IF NOT EXISTS \`client_system_info\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`user_id\` INT DEFAULT NULL COMMENT '用户ID',
      \`invitation_code\` VARCHAR(50) DEFAULT NULL COMMENT '邀请码',
      \`device_id\` VARCHAR(255) DEFAULT NULL COMMENT '设备ID',
      \`platform\` VARCHAR(50) DEFAULT NULL COMMENT '平台',
      \`userAgent\` VARCHAR(500) DEFAULT NULL COMMENT '浏览器User-Agent',
      \`browserName\` VARCHAR(100) DEFAULT NULL COMMENT '浏览器名称',
      \`browserVersion\` VARCHAR(50) DEFAULT NULL COMMENT '浏览器版本',
      \`osName\` VARCHAR(100) DEFAULT NULL COMMENT '操作系统名称',
      \`osVersion\` VARCHAR(50) DEFAULT NULL COMMENT '操作系统版本',
      \`deviceType\` VARCHAR(50) DEFAULT NULL COMMENT '设备类型',
      \`language\` VARCHAR(20) DEFAULT NULL COMMENT '浏览器语言',
      \`screenResolution\` VARCHAR(50) DEFAULT NULL COMMENT '屏幕分辨率',
      \`colorDepth\` INT DEFAULT NULL COMMENT '颜色深度',
      \`hardwareConcurrency\` INT DEFAULT NULL COMMENT 'CPU核心数',
      \`deviceMemory\` FLOAT DEFAULT NULL COMMENT '设备内存(GB)',
      \`timezone\` VARCHAR(50) DEFAULT NULL COMMENT '时区',
      \`timezoneOffset\` INT DEFAULT NULL COMMENT '时区偏移量',
      \`cookieEnabled\` TINYINT(1) DEFAULT NULL COMMENT 'Cookie是否启用',
      \`doNotTrack\` VARCHAR(20) DEFAULT NULL COMMENT 'Do Not Track设置',
      \`javaEnabled\` TINYINT(1) DEFAULT NULL COMMENT 'Java是否启用',
      \`plugins\` TEXT DEFAULT NULL COMMENT '浏览器插件列表',
      \`connectionType\` VARCHAR(50) DEFAULT NULL COMMENT '网络连接类型',
      \`referrer\` VARCHAR(500) DEFAULT NULL COMMENT '来源页面',
      \`currentUrl\` VARCHAR(500) DEFAULT NULL COMMENT '当前页面URL',
      \`lastHeartbeat\` DATETIME DEFAULT NULL COMMENT '最后心跳时间',
      INDEX \`idx_user_id\` (\`user_id\`),
      INDEX \`idx_invitation_code\` (\`invitation_code\`),
      INDEX \`idx_device_id\` (\`device_id\`),
      INDEX \`idx_last_heartbeat\` (\`lastHeartbeat\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await sequelize.query(sql);
    console.log('client_system_info 表创建成功！');

    process.exit(0);
  } catch (error) {
    console.error('创建表失败:', error);
    process.exit(1);
  }
}

migrate();