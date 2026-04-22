import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Button, Space, Tag, Statistic, Switch, message, Modal } from 'antd';
import { PlayCircleOutlined, StopOutlined, ReloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

function Operations() {
  const [gatewayRunning, setGatewayRunning] = useState(false);
  const [launcherRunning, setLauncherRunning] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleStartGateway = () => {
    setLoading(true);
    setTimeout(() => {
      setGatewayRunning(true);
      setLoading(false);
      message.success('Gateway 已启动');
    }, 1500);
  };

  const handleStopGateway = () => {
    Modal.confirm({
      title: '确认停止',
      icon: <ExclamationCircleOutlined />,
      content: '确定要停止 Gateway 服务吗？',
      onOk: () => {
        setLoading(true);
        setTimeout(() => {
          setGatewayRunning(false);
          setLoading(false);
          message.success('Gateway 已停止');
        }, 1000);
      }
    });
  };

  const handleRestartGateway = () => {
    Modal.confirm({
      title: '确认重启',
      content: '确定要重启 Gateway 服务吗？',
      onOk: () => {
        setLoading(true);
        setTimeout(() => {
          setGatewayRunning(true);
          setLoading(false);
          message.success('Gateway 已重启');
        }, 2000);
      }
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
                  <Tag color={launcherRunning ? 'green' : 'red'}>
                    {launcherRunning ? '运行中' : '已停止'}
                  </Tag>
                  <Text type="secondary">版本 1.0.0</Text>
                </Space>
              </div>
              <Switch checked={launcherRunning} />
            </div>
          </Card>
        </Col>

        <Col span={12}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Title level={4}>Gateway 服务</Title>
                <Space>
                  <Tag color={gatewayRunning ? 'green' : 'red'}>
                    {gatewayRunning ? '运行中' : '已停止'}
                  </Tag>
                  <Text type="secondary">端口 18789</Text>
                </Space>
              </div>
              <Space>
                <Button 
                  type="primary" 
                  icon={<PlayCircleOutlined />} 
                  onClick={handleStartGateway}
                  disabled={gatewayRunning || loading}
                >
                  启动
                </Button>
                <Button 
                  danger 
                  icon={<StopOutlined />} 
                  onClick={handleStopGateway}
                  disabled={!gatewayRunning || loading}
                >
                  停止
                </Button>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={handleRestartGateway}
                  disabled={loading}
                >
                  重启
                </Button>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 24 }}>
        <Title level={4}>运营操作</Title>
        <Row gutter={16}>
          <Col span={6}>
            <Card hoverable style={{ textAlign: 'center' }}>
              <PlayCircleOutlined style={{ fontSize: 36, color: '#52c41a' }} />
              <Title level={5}>一键启动</Title>
              <Paragraph type="secondary">启动所有服务</Paragraph>
              <Button type="primary" onClick={() => { setGatewayRunning(true); setLauncherRunning(true); message.success('已启动'); }}>
                执行
              </Button>
            </Card>
          </Col>
          <Col span={6}>
            <Card hoverable style={{ textAlign: 'center' }}>
              <StopOutlined style={{ fontSize: 36, color: '#ff4d4f' }} />
              <Title level={5}>一键停止</Title>
              <Paragraph type="secondary">停止所有服务</Paragraph>
              <Button danger onClick={() => { setGatewayRunning(false); message.success('已停止'); }}>
                执行
              </Button>
            </Card>
          </Col>
          <Col span={6}>
            <Card hoverable style={{ textAlign: 'center' }}>
              <ReloadOutlined style={{ fontSize: 36, color: '#1890ff' }} />
              <Title level={5}>重启服务</Title>
              <Paragraph type="secondary">重启 Gateway</Paragraph>
              <Button onClick={handleRestartGateway}>执行</Button>
            </Card>
          </Col>
          <Col span={6}>
            <Card hoverable style={{ textAlign: 'center' }}>
              <ExclamationCircleOutlined style={{ fontSize: 36, color: '#faad14' }} />
              <Title level={5}>健康检查</Title>
              <Paragraph type="secondary">检查服务状态</Paragraph>
              <Button onClick={() => message.info('健康检查正常')}>执行</Button>
            </Card>
          </Col>
        </Row>
      </Card>

      <Card style={{ marginTop: 24 }}>
        <Title level={4}>服务状态</Title>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="Launcher" value={launcherRunning ? '在线' : '离线'} valueStyle={{ color: launcherRunning ? '#52c41a' : '#ff4d4f' }} />
          </Col>
          <Col span={6}>
            <Statistic title="Gateway" value={gatewayRunning ? '在线' : '离线'} valueStyle={{ color: gatewayRunning ? '#52c41a' : '#ff4d4f' }} />
          </Col>
          <Col span={6}>
            <Statistic title="API连接" value="正常" valueStyle={{ color: '#52c41a' }} />
          </Col>
          <Col span={6}>
            <Statistic title="运行时长" value="2h 30m" />
          </Col>
        </Row>
      </Card>
    </div>
  );
}

export default Operations;
