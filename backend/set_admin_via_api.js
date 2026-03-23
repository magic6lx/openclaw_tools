const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/users/set-admin/HGKDBQUSUAJ',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('响应状态:', res.statusCode);
    console.log('响应数据:', data);
    
    try {
      const result = JSON.parse(data);
      if (result.success) {
        console.log('\n✅ 管理员权限设置成功！');
        console.log(result.message);
        console.log('\n请退出登录后重新登录，即可看到管理员功能');
      } else {
        console.log('\n❌ 设置失败:', result.message);
      }
    } catch (e) {
      console.log('解析响应失败:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('请求失败:', error.message);
  console.error('请确保后端服务器正在运行在 http://localhost:3000');
});

req.end();