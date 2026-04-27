import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Typography, Row, Col, Button, Space, Tag, message, Modal, Spin } from 'antd';
import { PlayCircleOutlined, StopOutlined, SyncOutlined, ExclamationCircleOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const LAUNCHER_API = 'http://127.0.0.1:3003';

function Operations() {
  const [gatewayStatus, setGatewayStatus] = useState('stopped');
  const [launcherStatus, setLauncherStatus] = useState('checking');
  const [openclawStatus, setOpenclawStatus] = useState('unknown');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isPollingLogs, setIsPollingLogs] = useState(false);
  const logIntervalRef = useRef(null);
  const logContainerRef = useRef(null);

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

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`${LAUNCHER_API}/logs?limit=50`);
      const data = await res.json();
      if (data.logs && data.logs.length > 0) {
        setLogs(data.logs.reverse());
      }
    } catch (err) {
      console.error('获取日志失败:', err);
    }
  }, []);

  const startLogPolling = () => {
    setIsPollingLogs(true);
    fetchLogs();
    logIntervalRef.current = setInterval(fetchLogs, 1500);
  };

  const stopLogPolling = () => {
    setIsPollingLogs(false);
    if (logIntervalRef.current) {
      clearInterval(logIntervalRef.current);
      logIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (logIntervalRef.current) {
        clearInterval(logIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleGatewayAction = async (action) => {
    setActionLoading(true);
    startLogPolling();

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
      setTimeout(() => {
        setActionLoading(false);
        stopLogPolling();
      }, 5000);
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

  const clearLogs = () => {
    setLogs([]);
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

  const getOpenClawConsoleButton = () => {
    if (gatewayStatus === 'running') {
      return (
        <Button
          type="link"
          icon={<ExclamationCircleOutlined />}
          onClick={() => window.open('http://127.0.0.1:18789', '_blank')}
          style={{ color: '#1890ff' }}
        >
          打开控制台
        </Button>
      );
    }
    return null;
  };

  const canOperateGateway = launcherStatus === 'online' && (openclawStatus === 'running' || openclawStatus === 'installed');

  const getLogLevelColor = (level) => {
    switch (level) {
      case 'INFO': return '#4fc3f7';
      case 'WARN': return '#ffb74d';
      case 'ERROR': return '#ef5350';
      case 'DEBUG': return '#90a4ae';
      default: return '#d4d4d4';
    }
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
                  {getLauncherTag()}
                  <Text type="secondary">v1.0.2</Text>
                </Space>
              </div>
              {launcherStatus === 'offline' && (
                <Button type="link" onClick={() => window.open('/downloads/OpenClawLauncher-win-x64-v1.0.2.zip', '_blank')}>
                  下载 Launcher v1.0.2
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
                  {getOpenClawConsoleButton()}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>实时日志</Title>
          <Space>
            {isPollingLogs && <Tag color="blue">实时监控中</Tag>}
            <Button
              size="small"
              icon={<DeleteOutlined />}
              onClick={clearLogs}
              disabled={logs.length === 0}
            >
              清空
            </Button>
            <Button
              size="small"
              icon={<SyncOutlined />}
              onClick={fetchLogs}
            >
              刷新
            </Button>
          </Space>
        </div>
        <Card
          ref={logContainerRef}
          style={{
            background: '#1e1e1e',
            color: '#d4d4d4',
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: 12,
            maxHeight: 400,
            overflow: 'auto',
            padding: '8px 12px'
          }}
        >
          {logs.length === 0 ? (
            <Text style={{ color: '#666' }}>暂无日志，点击启动/停止后会自动刷新</Text>
          ) : (
            logs.map((log, index) => (
              <div key={index} style={{ marginBottom: 4, display: 'flex', alignItems: 'flex-start' }}>
                <Text style={{ color: '#666', marginRight: 8, flexShrink: 0 }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </Text>
                <Text style={{ color: getLogLevelColor(log.level), marginRight: 8, flexShrink: 0, width: 50 }}>
                  [{log.level}]
                </Text>
                <Text style={{ color: '#d4d4d4' }}>
                  {log.message}
                </Text>
              </div>
            ))
          )}
          {actionLoading && (
            <div style={{ marginTop: 8 }}>
              <Spin size="small" style={{ color: '#fff' }} />
              <Text style={{ color: '#666', marginLeft: 8 }}>操作进行中...</Text>
            </div>
          )}
        </Card>
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