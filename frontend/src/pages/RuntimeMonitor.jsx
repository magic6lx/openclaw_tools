import React, { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Button, Space, Alert, Descriptions, Typography, message, Spin, Badge } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningOutlined, DesktopOutlined, ChromeOutlined, WindowsOutlined, AppleOutlined, LinuxOutlined, MobileOutlined, GlobalOutlined } from '@ant-design/icons';
import clientMonitorService from '../services/clientMonitorService';
import openClawGatewayService from '../services/openClawGatewayService';

const { Title, Text, Paragraph } = Typography;

const RuntimeMonitor = () => {
  const [clientInfo, setClientInfo] = useState({ data: null, loading: false, error: null });
  const [gatewayStatus, setGatewayStatus] = useState({ connected: false, loading: true, error: null, data: null });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const heartbeatIntervalRef = useRef(null);
  const reconnectIntervalRef = useRef(null);

  useEffect(() => {
    loadClientInfo();
    connectToGateway();

    return () => {
      openClawGatewayService.disconnect();
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (reconnectIntervalRef.current) {
        clearInterval(reconnectIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (autoRefresh && gatewayStatus.connected) {
      openClawGatewayService.requestStatus();
    }
  }, [autoRefresh, gatewayStatus.connected]);

  const loadClientInfo = () => {
    const info = clientMonitorService.getClientSystemInfo();
    setClientInfo({ data: info, loading: false, error: null });
  };

  const connectToGateway = async () => {
    setGatewayStatus(prev => ({ ...prev, loading: true, error: null }));

    openClawGatewayService.on('open', () => {
      setGatewayStatus(prev => ({ ...prev, connected: true, loading: false, error: null }));
      message.success('已连接到OpenClaw Gateway');
    });

    openClawGatewayService.on('close', (event) => {
      setGatewayStatus(prev => ({ ...prev, connected: false, loading: false }));
    });

    openClawGatewayService.on('error', (error) => {
      setGatewayStatus(prev => ({
        ...prev,
        connected: false,
        loading: false,
        error: '无法连接到OpenClaw Gateway'
      }));
    });

    openClawGatewayService.on('status', (status) => {
      setGatewayStatus(prev => ({ ...prev, data: status }));
    });

    try {
      await openClawGatewayService.connect();
    } catch (error) {
      setGatewayStatus(prev => ({
        ...prev,
        connected: false,
        loading: false,
        error: '无法连接到OpenClaw Gateway'
      }));
    }
  };

  const handleReconnect = () => {
    openClawGatewayService.disconnect();
    setTimeout(connectToGateway, 500);
  };

  const handleRefreshClientInfo = () => {
    loadClientInfo();
    clientMonitorService.submitClientInfo();
    message.success('已刷新客户端信息');
  };

  const getOSIcon = (osName) => {
    if (!osName) return <DesktopOutlined />;
    const name = osName.toLowerCase();
    if (name.includes('windows')) return <WindowsOutlined />;
    if (name.includes('mac')) return <AppleOutlined />;
    if (name.includes('linux')) return <LinuxOutlined />;
    if (name.includes('mobile')) return <MobileOutlined />;
    return <DesktopOutlined />;
  };

  const renderClientInfo = () => {
    const info = clientInfo.data;

    return (
      <Card title="客户端系统信息" extra={<Button size="small" icon={<ReloadOutlined />} onClick={handleRefreshClientInfo}>刷新</Button>}>
        {clientInfo.error ? (
          <Alert message={clientInfo.error} type="error" showIcon />
        ) : (
          <Descriptions column={2} size="small">
            <Descriptions.Item label="设备ID">
              <Text code copyable style={{ fontSize: 11 }}>{info?.deviceId}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="设备类型">
              <Space>
                {getOSIcon(info?.osName)}
                {info?.deviceType || 'desktop'}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="操作系统">
              {info?.osName} {info?.osVersion}
            </Descriptions.Item>
            <Descriptions.Item label="平台">
              {info?.platform}
            </Descriptions.Item>
            <Descriptions.Item label="浏览器">
              <Space>
                <ChromeOutlined />
                {info?.browserName} {info?.browserVersion}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="语言">
              <GlobalOutlined /> {info?.language}
            </Descriptions.Item>
            <Descriptions.Item label="屏幕分辨率">
              {info?.screenResolution}
            </Descriptions.Item>
            <Descriptions.Item label="颜色深度">
              {info?.colorDepth} 位
            </Descriptions.Item>
            <Descriptions.Item label="CPU核心数">
              {info?.hardwareConcurrency}
            </Descriptions.Item>
            <Descriptions.Item label="设备内存">
              {info?.deviceMemory}
            </Descriptions.Item>
            <Descriptions.Item label="时区">
              {info?.timezone} (UTC{info?.timezoneOffset > 0 ? '-' : '+'}{Math.abs(info?.timezoneOffset)})
            </Descriptions.Item>
            <Descriptions.Item label="网络类型">
              {info?.connectionType || 'Unknown'}
            </Descriptions.Item>
            <Descriptions.Item label="Cookie启用">
              {info?.cookieEnabled ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Do Not Track">
              {info?.doNotTrack}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>
    );
  };

  const renderGatewayStatus = () => {
    const { connected, loading, error, data } = gatewayStatus;

    let statusColor = 'default';
    let statusText = '未知';
    let StatusIcon = <WarningOutlined />;

    if (loading) {
      statusColor = 'processing';
      statusText = '连接中...';
    } else if (error) {
      statusColor = 'error';
      statusText = '未连接';
      StatusIcon = <CloseCircleOutlined />;
    } else if (connected && data) {
      statusColor = 'success';
      statusText = '运行中';
      StatusIcon = <CheckCircleOutlined />;
    } else if (connected) {
      statusColor = 'processing';
      statusText = '已连接';
      StatusIcon = <CheckCircleOutlined />;
    }

    return (
      <Card
        title="OpenClaw Gateway 状态"
        extra={
          <Space>
            <Badge status={statusColor} text={statusText} />
            <Button size="small" icon={<ReloadOutlined />} onClick={handleReconnect} disabled={loading}>
              重连
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip="正在连接本地Gateway..." />
          </div>
        ) : error ? (
          <Alert
            message="无法连接到OpenClaw Gateway"
            description={
              <div>
                <Paragraph>
                  请确保OpenClaw桌面应用正在运行，并且Gateway端口(18789)未被防火墙阻止。
                </Paragraph>
                <Paragraph type="secondary">
                  连接地址: ws://127.0.0.1:18789
                </Paragraph>
              </div>
            }
            type="error"
            showIcon
          />
        ) : !connected ? (
          <Alert
            message="OpenClaw Gateway未连接"
            description="点击重连按钮尝试重新连接"
            type="warning"
            showIcon
          />
        ) : (
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="连接状态">
              <Tag color="green">已连接</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Gateway版本">
              {data?.version || 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="运行时间">
              {data?.uptime ? `${Math.floor(data.uptime / 3600)}小时${Math.floor((data.uptime % 3600) / 60)}分钟` : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="端口">
              {data?.port || 18789}
            </Descriptions.Item>
            <Descriptions.Item label="配置文件" span={2}>
              {data?.configPath || 'N/A'}
            </Descriptions.Item>
            {data?.error && (
              <Descriptions.Item label="错误信息" span={2}>
                <Alert message={data.error} type="error" showIcon />
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Card>
    );
  };

  const renderGatewayStats = () => {
    const { data } = gatewayStatus;

    if (!data) return null;

    return (
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="活跃任务"
              value={data?.activeTasks || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总任务数"
              value={data?.totalTasks || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="CPU使用率"
              value={data?.cpuUsage ? `${data.cpuUsage}%` : 'N/A'}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="内存使用"
              value={data?.memoryUsage ? `${data.memoryUsage}MB` : 'N/A'}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>
    );
  };

  const renderClientBrowserInfo = () => {
    const info = clientInfo.data;

    return (
      <Card title="浏览器环境" size="small">
        <Row gutter={[16, 8]}>
          <Col span={12}>
            <Text type="secondary">User-Agent:</Text>
            <div style={{ marginTop: 4 }}>
              <Text code style={{ fontSize: 10 }}>{info?.userAgent}</Text>
            </div>
          </Col>
          <Col span={12}>
            <Text type="secondary">来源:</Text>
            <div style={{ marginTop: 4 }}>
              <Text>{info?.referrer || '直接访问'}</Text>
            </div>
          </Col>
        </Row>
        <Row gutter={[16, 8]} style={{ marginTop: 8 }}>
          <Col span={12}>
            <Text type="secondary">当前页面:</Text>
            <div style={{ marginTop: 4 }}>
              <Text code style={{ fontSize: 10 }} copyable>{info?.currentUrl}</Text>
            </div>
          </Col>
          <Col span={12}>
            <Text type="secondary">浏览器插件:</Text>
            <div style={{ marginTop: 4 }}>
              <Text>{info?.plugins?.length > 0 ? info.plugins.join(', ') : '无'}</Text>
            </div>
          </Col>
        </Row>
      </Card>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>运行监控</Title>
      <Paragraph type="secondary">
        监控本机OpenClaw Gateway运行状态和客户端浏览器环境
      </Paragraph>

      <Space style={{ marginBottom: 16 }}>
        <Button
          type={autoRefresh ? 'primary' : 'default'}
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          {autoRefresh ? '自动刷新: 开' : '自动刷新: 关'}
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => { loadClientInfo(); openClawGatewayService.requestStatus(); }}>
          刷新
        </Button>
      </Space>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          {renderClientInfo()}
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          {renderGatewayStatus()}
        </Col>
      </Row>

      {gatewayStatus.data && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            {renderGatewayStats()}
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          {renderClientBrowserInfo()}
        </Col>
      </Row>
    </div>
  );
};

export default RuntimeMonitor;