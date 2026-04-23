import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Button, Space, Tag, message, Modal, Spin } from 'antd';
import { PlayCircleOutlined, StopOutlined, ReloadOutlined, ExclamationCircleOutlined, SyncOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const LAUNCHER_API = 'http://127.0.0.1:3003';

function Operations() {
  const [gatewayStatus, setGatewayStatus] = useState('stopped');
  const [launcherStatus, setLauncherStatus] = useState('unknown');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${LAUNCHER_API}/status`);
      if (res.ok) {
        const data = await res.json();
        setLauncherStatus(data.openClawStatus === 'installed' || data.openClawStatus === 'running' ? 'running' : 'stopped');
        setGatewayStatus(data.gatewayRunning ? 'running' : 'stopped');
      } else {
        setLauncherStatus('not_found');
      }
    } catch (err) {
      setLauncherStatus('not_found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleGatewayAction = async (action) => {
    setActionLoading(true);
    try {
      const endpoint = action === 'start' ? '/gateway/start' : '/gateway/stop';
      const res = await fetch(`${LAUNCHER_API}${endpoint}`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        message.success(`Gateway ${action === 'start' ? '启动' : '停止'}成功`);
        fetchStatus();
      } else {
        message.error(data.error || `操作失败: ${data.message || '未知错误'}`);
      }
    } catch (err) {
      message.error(`无法连接 Launcher: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmAction = (action, actionText) => {
    Modal.confirm({
      title: `确认${actionText}`,
      icon: <ExclamationCircleOutlined />,
      content: `确定要${actionText} Gateway 服务吗？`,
      onOk: () => handleGatewayAction(action)
    });
  };

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Title level={2}>日常运营</Title>
      <Paragraph type="secondary">管理 OpenClaw 的启动和停止</Paragraph>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Title level={4}>Launcher 服务</Title>
                <Space>
                  {loading ? <Spin size="small" /> : (
                    <Tag color={launcherStatus === 'running' ? 'green' : 'red'}>
                      {launcherStatus === 'running' ? '运行中' : launcherStatus === 'not_found' ? '未安装' : '已停止'}
                    </Tag>
                  )}
                  <Text type="secondary">v1.0.0</Text>
                </Space>
              </div>
              {launcherStatus === 'not_found' && (
                <Button type="link" onClick={() => window.open('/download', '_blank')}>
                  下载 Launcher
                </Button>
              )}
            </div>
          </Card>
        </Col>

        <Col span={12}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Title level={4}>Gateway 服务</Title>
                <Space>
                  {loading ? <Spin size="small" /> : (
                    <Tag color={gatewayStatus === 'running' ? 'green' : 'red'}>
                      {gatewayStatus === 'running' ? '运行中' : '已停止'}
                    </Tag>
                  )}
                  <Text type="secondary">端口 18789</Text>
                </Space>
              </div>
              <Space>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => confirmAction('start', '启动')}
                  disabled={gatewayStatus === 'running' || actionLoading || launcherStatus !== 'running'}
                  loading={actionLoading}
                >
                  启动
                </Button>
                <Button
                  danger
                  icon={<StopOutlined />}
                  onClick={() => confirmAction('stop', '停止')}
                  disabled={gatewayStatus !== 'running' || actionLoading}
                  loading={actionLoading}
                >
                  停止
                </Button>
                <Button
                  icon={<SyncOutlined />}
                  onClick={() => confirmAction('restart', '重启')}
                  disabled={actionLoading || launcherStatus !== 'running'}
                  loading={actionLoading}
                >
                  重启
                </Button>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 24 }}>
        <Title level={4}>快捷操作</Title>
        <Row gutter={16}>
          <Col span={8}>
            <Card hoverable style={{ textAlign: 'center' }}>
              <PlayCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
              <Title level={5}>一键启动</Title>
              <Paragraph type="secondary">启动 Launcher 和 Gateway</Paragraph>
              <Button
                type="primary"
                disabled={launcherStatus !== 'running' || gatewayStatus === 'running'}
                onClick={() => handleGatewayAction('start')}
                loading={actionLoading}
              >
                执行
              </Button>
            </Card>
          </Col>
          <Col span={8}>
            <Card hoverable style={{ textAlign: 'center' }}>
              <StopOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
              <Title level={5}>一键停止</Title>
              <Paragraph type="secondary">停止 Gateway 服务</Paragraph>
              <Button
                danger
                disabled={gatewayStatus !== 'running'}
                onClick={() => handleGatewayAction('stop')}
                loading={actionLoading}
              >
                执行
              </Button>
            </Card>
          </Col>
          <Col span={8}>
            <Card hoverable style={{ textAlign: 'center' }}>
              <ReloadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
              <Title level={5}>重启服务</Title>
              <Paragraph type="secondary">重启 Gateway 服务</Paragraph>
              <Button
                disabled={launcherStatus !== 'running'}
                onClick={() => handleGatewayAction('restart')}
                loading={actionLoading}
              >
                执行
              </Button>
            </Card>
          </Col>
        </Row>
      </Card>

      <Card style={{ marginTop: 24 }}>
        <Title level={4}>运行状态</Title>
        <Row gutter={16}>
          <Col span={6}>
            <Tag color={launcherStatus === 'running' ? 'green' : 'red'}>
              Launcher: {launcherStatus === 'running' ? '在线' : '离线'}
            </Tag>
          </Col>
          <Col span={6}>
            <Tag color={gatewayStatus === 'running' ? 'green' : 'red'}>
              Gateway: {gatewayStatus === 'running' ? '运行中' : '已停止'}
            </Tag>
          </Col>
          <Col span={12}>
            <Text type="secondary">
              {launcherStatus !== 'running' && '请确保 Launcher 已启动'}
              {launcherStatus === 'running' && gatewayStatus !== 'running' && '点击"启动"按钮启动 Gateway'}
              {launcherStatus === 'running' && gatewayStatus === 'running' && '所有服务运行正常'}
            </Text>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

export default Operations;
