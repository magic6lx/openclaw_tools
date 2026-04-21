const request = require('supertest');
const app = require('../src/index');

describe('OpenClaw智能配置系统API测试', () => {
  let testCode;
  let authToken;
  let userId;

  describe('邀请码管理', () => {
    test('生成邀请码', async () => {
      const response = await request(app)
        .post('/api/invitation-codes/generate')
        .send({ max_devices: 3 })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('code');
      expect(response.body.data.code.length).toBe(11);
      expect(response.body.data.code).toMatch(/^[A-Z]+$/);

      testCode = response.body.data.code;
    });

    test('验证邀请码', async () => {
      const response = await request(app)
        .get(`/api/invitation-codes/${testCode}/validate`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('valid');
    });

    test('绑定设备', async () => {
      const response = await request(app)
        .post(`/api/invitation-codes/${testCode}/bind`)
        .send({
          device_id: 'test-device-001',
          device_info: {
            device_name: 'Test Device',
            os_type: 'Windows',
            os_version: '10'
          }
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('device_id');

      userId = response.body.data.id;
    });

    test('获取设备列表', async () => {
      const response = await request(app)
        .get(`/api/invitation-codes/${testCode}/devices`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('devices');
      expect(Array.isArray(response.body.data.devices)).toBe(true);
    });

    test('禁用邀请码', async () => {
      const response = await request(app)
        .put(`/api/invitation-codes/${testCode}/disable`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('disabled');
    });

    test('启用邀请码', async () => {
      const response = await request(app)
        .put(`/api/invitation-codes/${testCode}/enable`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('active');
    });
  });

  describe('用户认证', () => {
    test('使用邀请码登录', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          code: testCode,
          device_id: 'test-device-002',
          device_info: {
            device_name: 'Test Device 2',
            os_type: 'Windows',
            os_version: '10'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');

      authToken = response.body.data.token;
    });

    test('获取用户信息', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('device_id');
    });

    test('刷新Token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ token: authToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');

      authToken = response.body.data.token;
    });

    test('更新用户信息', async () => {
      const response = await request(app)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          device_name: 'Updated Device Name'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.device_name).toBe('Updated Device Name');
    });

    test('登出', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('未授权访问受保护的路由', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('API文档', () => {
    test('获取API文档', async () => {
      const response = await request(app)
        .get('/api-docs/')
        .expect(200);

      expect(response.text).toContain('OpenClaw智能配置系统API');
    });
  });

  describe('根路由', () => {
    test('获取根路径信息', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body.message).toBe('OpenClaw智能配置系统API');
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.documentation).toBe('/api-docs');
    });
  });
});