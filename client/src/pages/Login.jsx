import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, message, Space } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text, Paragraph } = Typography;

function Login() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const success = await login(values.code);
      if (success) {
        message.success('登录成功');
        navigate('/');
      }
    } catch (err) {
      message.error(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: 24
    }}>
      <Card style={{ width: 400, boxShadow: '0 14px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64,
            height: 64,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <KeyOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <Title level={3} style={{ margin: 0 }}>OpenClaw 运维工具</Title>
          <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
            请输入邀请码登录
          </Paragraph>
        </div>

        <Form layout="vertical" onFinish={handleLogin} size="large">
          <Form.Item
            name="code"
            rules={[
              { required: true, message: '请输入邀请码' },
              { min: 8, message: '邀请码至少8位' }
            ]}
          >
            <Input
              placeholder="请输入邀请码"
              prefix={<KeyOutlined style={{ color: '#999' }} />}
              style={{ height: 48 }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 48 }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default Login;
