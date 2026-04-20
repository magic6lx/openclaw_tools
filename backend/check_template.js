const mysql = require('mysql2/promise');

async function checkTemplate() {
  const connection = await mysql.createConnection({
    host: '134.175.18.139',
    port: 3306,
    user: 'root',
    password: 'root@126.com',
    database: 'openclaw_tools'
  });

  const [rows] = await connection.execute(
    "SELECT id, name, created_at FROM config_templates ORDER BY created_at DESC LIMIT 3"
  );

  console.log('\n=== 最近的模板 ===');
  rows.forEach(row => {
    console.log(`ID: ${row.id}, 名称: ${row.name}, 创建时间: ${row.created_at}`);
  });

  if (rows.length > 0) {
    const latestId = rows[0].id;
    const [detail] = await connection.execute(
      "SELECT config_content FROM config_templates WHERE id = ?",
      [latestId]
    );

    if (detail[0]) {
      const content = detail[0].config_content;
      
      console.log('\n=== 模板元数据 ===');
      console.log(JSON.stringify(content.meta, null, 2));
      
      console.log('\n=== 文件列表 (前3个) ===');
      content.files.slice(0, 3).forEach(file => {
        console.log(`\n文件: ${file.fileName}`);
        console.log(`相对路径: ${file.relativePath}`);
        console.log(`分组: ${file.structure?.group}/${file.structure?.subGroup}`);
        console.log(`内容预览: ${file.content.substring(0, 100)}...`);
      });
      
      console.log('\n=== 主配置 (openclaw.json) ===');
      if (content.mainConfig) {
        console.log('工作空间路径:', JSON.stringify(content.mainConfig.agents?.defaults?.workspace || '未找到'));
      }
      
      console.log('\n=== 检查路径占位符 ===');
      const contentStr = JSON.stringify(content);
      const placeholders = ['{OPENCLAW_HOME}', '{HOME}', '{DOCUMENTS}', '{DESKTOP}'];
      placeholders.forEach(ph => {
        const count = (contentStr.match(new RegExp(ph.replace(/[{}]/g, '\\$&'), 'g')) || []).length;
        console.log(`${ph}: 出现 ${count} 次`);
      });
    }
  }

  await connection.end();
}

checkTemplate().catch(console.error);
