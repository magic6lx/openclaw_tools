import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { LoginOutlined } from '@ant-design/icons';
import { authService } from '../services/auth';

const { Title, Text } = Typography;

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const generateDeviceId = () => {
    return 'device_' + Math.random().toString(36).substr(2, 9);
  };

  const getDeviceInfo = () => {
    return {
      device_name: navigator.userAgent.includes('Windows') ? 'Windows PC' :
                   navigator.userAgent.includes('Mac') ? 'Mac' :
                   navigator.userAgent.includes('Linux') ? 'Linux' : 'Unknown',
      os_type: navigator.userAgent.includes('Windows') ? 'Windows' :
                navigator.userAgent.includes('Mac') ? 'macOS' :
                navigator.userAgent.includes('Linux') ? 'Linux' : 'Unknown',
      os_version: 'Unknown',
    };
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const deviceId = localStorage.getItem('deviceId') || generateDeviceId();
      localStorage.setItem('deviceId', deviceId);

      const deviceInfo = getDeviceInfo();
      const response = await authService.login(values.code, deviceId, deviceInfo);

      if (response.success) {
        authService.setToken(response.data.token);
        authService.setUser(response.data.user);
        message.success('登录成功');
        navigate('/dashboard');
      }
    } catch (error) {
      message.error(error.message || '登录失败，请检查邀请码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2}>OpenClaw</Title>
          <Text type="secondary">智能配置系统</Text>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          layout="vertical"
        >
          <Form.Item
            label="邀请码"
            name="code"
            rules={[
              { required: true, message: '请输入邀请码' },
              { len: 11, message: '邀请码必须为11位' },
              { pattern: /^[A-Z]+$/, message: '邀请码只能包含大写字母' },
            ]}
          >
            <Input
              prefix={<LoginOutlined />}
              placeholder="请输入11位邀请码"
              style={{ textTransform: 'uppercase' }}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            请联系管理员获取邀请码
          </Text>
        </div>
      </Card>
    </div>
  );
}

export default Login;