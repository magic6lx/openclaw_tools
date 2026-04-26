import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Row, Col, Button, Space, Tag, message, Modal, Spin } from 'antd';
import { PlayCircleOutlined, StopOutlined, ReloadOutlined, ExclamationCircleOutlined, SyncOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const LAUNCHER_API = 'http://127.0.0.1:3003';

function Operations() {
  const [gatewayStatus, setGatewayStatus] = useState('stopped');
  const [launcherStatus, setLauncherStatus] = useState('checking');
  const [openclawStatus, setOpenclawStatus] = useState('unknown');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const checkLauncherStatus = useCallback(async () => {
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${LAUNCHER_API}/status`, {
        signal: controller.signal,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setLauncherStatus('online');
        setOpenclawStatus(data.openClawStatus || 'unknown');
        setGatewayStatus(data.gatewayRunning ? 'running' : 'stopped');
      } else {
        setLauncherStatus('offline');
      }
    } catch (err) {
      setLauncherStatus('offline');
      setGatewayStatus('stopped');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkLauncherStatus();
    const interval = setInterval(checkLauncherStatus, 5000);
    return () => clearInterval(interval);
  }, [checkLauncherStatus]);

  const handleGatewayAction = async (action) => {
    setActionLoading(true);
    try {
      const endpoint = action === 'start' ? '/gateway/start' : action === 'stop' ? '/gateway/stop' : '/gateway/restart';
      const res = await fetch(`${LAUNCHER_API}${endpoint}`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        message.success(`Gateway ${action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'}成功`);
        checkLauncherStatus();
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

  const getLauncherTag = () => {
    if (launcherStatus === 'checking' || loading) {
      return <Tag icon={<Spin size="small" />} color="default">检测中</Tag>;
    }
    if (launcherStatus === 'online') {
      return <Tag color="green">运行中</Tag>;
    }
    return <Tag color="red">离线</Tag>;
  };

  const getOpenclawTag = () => {
    if (openclawStatus === 'running' || openclawStatus === 'installed') {
      return <Tag color="green">已安装</Tag>;
    }
    if (openclawStatus === 'not_installed') {
      return <Tag color="orange">未安装</Tag>;
    }
    return <Tag color="default">未检测</Tag>;
  };

  const getGatewayTag = () => {
    if (gatewayStatus === 'running') {
      return <Tag color="green">运行中</Tag>;
    }
    return <Tag color="red">已停止</Tag>;
  };

  const canOperateGateway = launcherStatus === 'online' && (openclawStatus === 'running' || openclawStatus === 'installed');

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
                  {getLauncherTag()}
                  <Text type="secondary">v1.0.0</Text>
                </Space>
              </div>
              {launcherStatus === 'offline' && (
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
                  {getGatewayTag()}
                  <Text type="secondary">端口 18789</Text>
                </Space>
              </div>
              <Space>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => confirmAction('start', '启动')}
                  disabled={!canOperateGateway || actionLoading}
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
                  disabled={!canOperateGateway || actionLoading}
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
                disabled={!canOperateGateway || gatewayStatus === 'running'}
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
                disabled={!canOperateGateway}
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
            {getLauncherTag()}
            <Text style={{ marginLeft: 8 }}>Launcher</Text>
          </Col>
          <Col span={6}>
            {getOpenclawTag()}
            <Text style={{ marginLeft: 8 }}>OpenClaw</Text>
          </Col>
          <Col span={6}>
            {getGatewayTag()}
            <Text style={{ marginLeft: 8 }}>Gateway</Text>
          </Col>
          <Col span={6}>
            <Text type="secondary">
              {launcherStatus === 'checking' && '检测中...'}
              {launcherStatus === 'offline' && 'Launcher离线'}
              {launcherStatus === 'online' && openclawStatus === 'not_installed' && '请先安装OpenClaw'}
              {launcherStatus === 'online' && (openclawStatus === 'running' || openclawStatus === 'installed') && gatewayStatus !== 'running' && '可启动Gateway'}
              {launcherStatus === 'online' && (openclawStatus === 'running' || openclawStatus === 'installed') && gatewayStatus === 'running' && '运行正常'}
            </Text>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

export default Operations;