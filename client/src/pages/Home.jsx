import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Button, Space, Tag, Spin, message, Alert, Divider } from 'antd';
import { DownloadOutlined, SettingOutlined, PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined, RocketOutlined, BugOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;
const LAUNCHER_API = 'http://127.0.0.1:3003';
const LAUNCHER_LAUNCH_URL = 'openclaw://launch';
const LAUNCHER_INSTALL_PATH = 'C:\\Program Files\\OpenClaw\\launcher.exe';

function Home() {
  const [launcherStatus, setLauncherStatus] = useState('checking');
  const [openclawStatus, setOpenclawStatus] = useState('unknown');
  const [serverStatus, setServerStatus] = useState('checking');
  const [launcherInstalled, setLauncherInstalled] = useState(null);

  useEffect(() => {
    checkLauncherStatus();
    checkServerStatus();
    checkLauncherInstalled();
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

  const checkLauncherInstalled = () => {
    const installed = localStorage.getItem('launcherInstalled');
    setLauncherInstalled(installed === 'true');
  };

  const handleDownload = () => {
    window.open('/launcher/download', '_blank');
    localStorage.setItem('launcherInstalled', 'true');
    setLauncherInstalled(true);
    message.success('如果下载未开始，请检查浏览器弹窗设置');
  };

  const handleLaunchLauncher = () => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = LAUNCHER_LAUNCH_URL;
      document.body.appendChild(iframe);
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
      message.success('正在启动Launcher...');
      setTimeout(() => {
        checkLauncherStatus();
      }, 3000);
    } catch (err) {
      message.error('启动Launcher失败，请手动启动或重新下载');
    }
  };

  const getLauncherStatusDisplay = () => {
    if (launcherStatus === 'checking') {
      return { tag: <Tag icon={<Spin size="small" />} color="default">检测中</Tag>, desc: '正在检测Launcher状态' };
    }
    if (launcherStatus === 'online') {
      return { tag: <Tag icon={<CheckCircleOutlined />} color="success">运行中</Tag>, desc: 'Launcher正在后台运行' };
    }
    return { tag: <Tag icon={<CloseCircleOutlined />} color="error">未启动</Tag>, desc: 'Launcher未运行' };
  };

  const getLauncherActionButton = () => {
    if (launcherStatus === 'checking') {
      return null;
    }

    if (launcherStatus === 'online') {
      return (
        <Tag icon={<CheckCircleOutlined />} color="success">
          Launcher运行中
        </Tag>
      );
    }

    return (
      <Space>
        {launcherInstalled ? (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleLaunchLauncher}
          >
            启动Launcher
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownload}
          >
            下载Launcher
          </Button>
        )}
        <Button
          icon={<BugOutlined />}
          onClick={() => window.location.href = '/diagnostics'}
        >
          诊断工具
        </Button>
      </Space>
    );
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

  const launcherDisplay = getLauncherStatusDisplay();

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Title level={2}>OpenClaw 运维工具</Title>

      {launcherStatus === 'offline' && (
        <Card style={{ marginBottom: 24, background: launcherInstalled ? '#e6f7ff' : '#fff7e6', borderColor: launcherInstalled ? '#1890ff' : '#faad14' }}>
          <Row gutter={16} align="middle">
            <Col span={launcherInstalled ? 16 : 12}>
              <Space align="start">
                {launcherInstalled ? (
                  <>
                    <RocketOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                    <div>
                      <Title level={5} style={{ margin: 0 }}>
                        Launcher 已下载但未启动
                      </Title>
                      <Paragraph style={{ margin: '8px 0 0' }}>
                        点击"启动Launcher"按钮，或双击桌面上的Launcher图标启动。
                      </Paragraph>
                    </div>
                  </>
                ) : (
                  <>
                    <DownloadOutlined style={{ fontSize: 24, color: '#faad14' }} />
                    <div>
                      <Title level={5} style={{ margin: 0 }}>
                        请下载并启动 Launcher
                      </Title>
                      <Paragraph style={{ margin: '8px 0 0' }}>
                        Launcher是OpenClaw的管理工具，需要先下载并启动才能使用完整功能。
                      </Paragraph>
                    </div>
                  </>
                )}
              </Space>
            </Col>
            <Col span={launcherInstalled ? 8 : 12} style={{ textAlign: 'right' }}>
              {getLauncherActionButton()}
            </Col>
          </Row>
        </Card>
      )}

      {launcherStatus === 'online' && (
        <Alert
          message="Launcher 运行正常"
          description="所有功能可用"
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: 24 }}
        />
      )}

      <Card style={{ marginBottom: 24 }}>
        <Title level={4}><InfoCircleOutlined /> 系统说明</Title>
        <Paragraph>
          OpenClaw Tools 是一个强大的运维管理工具，帮助您快速完成 OpenClaw 的安装、配置和日常运营。
          本系统提供一键安装、智能配置、日常运营等功能，让运维工作更加简单高效。
        </Paragraph>
        <Divider style={{ margin: '16px 0' }} />
        <Row gutter={16}>
          <Col span={8}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">Launcher状态</Text>
              <div>{launcherDisplay.tag}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>{launcherDisplay.desc}</Text>
            </Space>
          </Col>
          <Col span={8}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">OpenClaw状态</Text>
              <div>{getOpenclawTag()}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {openclawStatus === 'running' ? '正在运行中' : openclawStatus === 'installed' ? '已安装' : '请启动Launcher后检测'}
              </Text>
            </Space>
          </Col>
          <Col span={8}>
            <Space direction="vertical" size={4}>
              <Text type="secondary">服务端连接</Text>
              <div>{getServerTag()}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {serverStatus === 'connected' ? '已连接到管理后台' : '连接管理后台服务'}
              </Text>
            </Space>
          </Col>
        </Row>
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
              <Button type="primary" icon={<DownloadOutlined />} disabled={launcherStatus !== 'online'}>
                立即安装
              </Button>
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
        <Space>
          <BugOutlined />
          <Text type="secondary">连接问题？</Text>
          <Button type="link" size="small" onClick={() => window.location.href = '/diagnostics'}>
            使用诊断工具
          </Button>
        </Space>
      </Card>
    </div>
  );
}

export default Home;