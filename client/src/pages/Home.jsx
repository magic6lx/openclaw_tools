import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Button, Space, Tag, Spin, message } from 'antd';
import { DownloadOutlined, SettingOutlined, PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;
const LAUNCHER_API = 'http://127.0.0.1:3003';

function Home() {
  const [launcherStatus, setLauncherStatus] = useState('checking');
  const [openclawStatus, setOpenclawStatus] = useState('unknown');
  const [serverStatus, setServerStatus] = useState('checking');

  useEffect(() => {
    checkLauncherStatus();
    checkServerStatus();
  }, []);

  const checkLauncherStatus = async () => {
    try {
      const res = await fetch(`${LAUNCHER_API}/status`, { timeout: 3000 });
      if (res.ok) {
        const data = await res.json();
        setLauncherStatus('online');
        setOpenclawStatus(data.openClawStatus || 'unknown');
      } else {
        setLauncherStatus('offline');
      }
    } catch (err) {
      setLauncherStatus('offline');
    }
  };

  const checkServerStatus = async () => {
    try {
      const res = await fetch('/api/health', { timeout: 3000 });
      if (res.ok) {
        setServerStatus('connected');
      } else {
        setServerStatus('disconnected');
      }
    } catch (err) {
      setServerStatus('disconnected');
    }
  };

  const getLauncherTag = () => {
    if (launcherStatus === 'checking') return <Tag icon={<Spin size="small" />} color="default">检测中</Tag>;
    if (launcherStatus === 'online') return <Tag icon={<CheckCircleOutlined />} color="success">运行中</Tag>;
    return <Tag icon={<CloseCircleOutlined />} color="error">未启动</Tag>;
  };

  const getOpenclawTag = () => {
    if (openclawStatus === 'running' || openclawStatus === 'installed') {
      return <Tag icon={<CheckCircleOutlined />} color="success">已安装</Tag>;
    }
    if (openclawStatus === 'not_installed') {
      return <Tag icon={<CloseCircleOutlined />} color="warning">未安装</Tag>;
    }
    return <Tag color="default">未检测</Tag>;
  };

  const getServerTag = () => {
    if (serverStatus === 'checking') return <Tag icon={<Spin size="small" />} color="default">检测中</Tag>;
    if (serverStatus === 'connected') return <Tag icon={<CheckCircleOutlined />} color="success">已连接</Tag>;
    return <Tag icon={<CloseCircleOutlined />} color="error">未连接</Tag>;
  };

  const handleDownload = () => {
    window.open('/launcher/download', '_blank');
  };

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Title level={2}>OpenClaw 运维工具</Title>

      {launcherStatus === 'offline' && (
        <Card style={{ marginBottom: 24, background: '#fff7e6', borderColor: '#faad14' }}>
          <Row gutter={16} align="middle">
            <Col span={16}>
              <Title level={5} style={{ margin: 0 }}>⚠️ Launcher 未启动</Title>
              <Paragraph style={{ margin: '8px 0 0' }}>
                请先运行 Launcher，才能使用完整功能。
              </Paragraph>
            </Col>
            <Col span={8} style={{ textAlign: 'right' }}>
              <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload}>
                下载 Launcher
              </Button>
            </Col>
          </Row>
        </Card>
      )}

      <Card style={{ marginBottom: 24 }}>
        <Title level={4}><InfoCircleOutlined /> 系统说明</Title>
        <Paragraph>
          OpenClaw 是一个强大的运维管理工具，帮助您快速完成 OpenClaw 的安装、配置和日常运营。
          本系统提供一键安装、智能配置、日常运营等功能，让运维工作更加简单高效。
        </Paragraph>
      </Card>

      <Title level={4}>快捷入口</Title>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card
            hoverable
            style={{ textAlign: 'center', padding: 24 }}
            cover={<SettingOutlined style={{ fontSize: 48, color: '#1890ff', marginTop: 20 }} />}
          >
            <Title level={5}>安装及配置</Title>
            <Paragraph type="secondary">一键安装OpenClaw，选择配置模板</Paragraph>
            <Link to="/install">
              <Button type="primary" icon={<DownloadOutlined />}>立即安装</Button>
            </Link>
          </Card>
        </Col>

        <Col span={8}>
          <Card
            hoverable
            style={{ textAlign: 'center', padding: 24 }}
            cover={<PlayCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginTop: 20 }} />}
          >
            <Title level={5}>日常运营</Title>
            <Paragraph type="secondary">管理OpenClaw启动和停止</Paragraph>
            <Link to="/operations">
              <Button type="primary" icon={<PlayCircleOutlined />} disabled={launcherStatus !== 'online'}>
                开始运营
              </Button>
            </Link>
          </Card>
        </Col>

        <Col span={8}>
          <Card
            hoverable
            style={{ textAlign: 'center', padding: 24 }}
            cover={<SettingOutlined style={{ fontSize: 48, color: '#722ed1', marginTop: 20 }} />}
          >
            <Title level={5}>配置管理</Title>
            <Paragraph type="secondary">查看和管理当前配置</Paragraph>
            <Link to="/config">
              <Button disabled={launcherStatus !== 'online'}>查看配置</Button>
            </Link>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 24 }}>
        <Title level={5}>系统状态</Title>
        <Row gutter={16}>
          <Col span={6}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Launcher状态</Text>
              <div>{getLauncherTag()}</div>
            </Space>
          </Col>
          <Col span={6}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">OpenClaw状态</Text>
              <div>{getOpenclawTag()}</div>
            </Space>
          </Col>
          <Col span={6}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">服务端连接</Text>
              <div>{getServerTag()}</div>
            </Space>
          </Col>
          <Col span={6}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">版本</Text>
              <div><Tag>v1.0.0</Tag></div>
            </Space>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

export default Home;
