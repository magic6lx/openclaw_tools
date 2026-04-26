import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Space, Tag, message, Steps, Spin, Descriptions, Divider } from 'antd';
import { SyncOutlined, CheckCircleOutlined, LoadingOutlined, RocketOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

function Install() {
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [versionInfo, setVersionInfo] = useState(null);
  const [statusInterval, setStatusInterval] = useState(null);

  const LAUNCHER_API = 'http://127.0.0.1:3003';

  const addLog = (level, msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time, level, msg }]);
  };

  const fetchInstallStatus = async () => {
    try {
      const res = await fetch(`${LAUNCHER_API}/install/status`);
      const data = await res.json();
      if (data.logs && data.logs.length > 0) {
        setLogs(data.logs.map(l => ({
          time: new Date(l.timestamp).toLocaleTimeString(),
          level: l.level,
          msg: l.message
        })));
      }
      if (!data.running) {
        if (statusInterval) clearInterval(statusInterval);
        setInstalling(false);
        if (data.logs?.some(l => l.level === 'ERROR')) {
          message.error('升级失败，请查看日志');
        } else {
          message.success('升级成功！');
          checkVersion();
        }
      }
    } catch (err) {
      console.error('获取安装状态失败:', err);
    }
  };

  const checkVersion = async () => {
    setChecking(true);
    setLogs([]);
    addLog('INFO', '正在检测 OpenClaw 版本...');

    try {
      const res = await fetch(`${LAUNCHER_API}/version`);
      const data = await res.json();

      if (data.installed) {
        setVersionInfo({
          installed: true,
          currentVersion: data.currentVersion,
          latestVersion: data.latestVersion,
          isLatest: data.isLatest,
          npmPath: data.npmPath
        });
        addLog('INFO', `当前版本: ${data.currentVersion}`);
        if (data.isLatest) {
          addLog('INFO', '已是最新版本');
        } else {
          addLog('WARN', `发现新版本: ${data.latestVersion}`);
        }
      } else {
        setVersionInfo({
          installed: false,
          message: data.message || '未检测到 OpenClaw 安装'
        });
        addLog('WARN', '未检测到 OpenClaw 安装');
      }
    } catch (err) {
      console.error('检测版本失败:', err);
      setVersionInfo({ installed: false, error: err.message });
      addLog('ERROR', `检测失败: ${err.message}`);
    }
    setChecking(false);
  };

  const handleUpgrade = async () => {
    setInstalling(true);
    setProgress(10);
    setLogs([]);
    addLog('INFO', '正在连接 Launcher...');

    try {
      const res = await fetch(`${LAUNCHER_API}/install/start`, { method: 'POST' });
      const data = await res.json();

      if (!data.success && data.message === '安装已在进行中') {
        addLog('WARN', '安装已在进行中，请稍候...');
        const interval = setInterval(fetchInstallStatus, 2000);
        setStatusInterval(interval);
        return;
      }

      addLog('INFO', '升级已启动，等待完成...');
      setProgress(30);

      const interval = setInterval(fetchInstallStatus, 2000);
      setStatusInterval(interval);

    } catch (err) {
      addLog('ERROR', `连接Launcher失败: ${err.message}`);
      addLog('ERROR', '请确保Launcher正在运行');
      setInstalling(false);
    }
  };

  useEffect(() => {
    checkVersion();
  }, []);

  const renderVersionCard = () => {
    if (!versionInfo) return null;

    if (versionInfo.installed && versionInfo.isLatest) {
      return (
        <Card style={{ textAlign: 'center', padding: 20 }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
          <Title level={4} style={{ marginTop: 16 }}>已是最新版本</Title>
          <Descriptions style={{ marginTop: 16 }} bordered size="small">
            <Descriptions.Item label="当前版本">{versionInfo.currentVersion}</Descriptions.Item>
            <Descriptions.Item label="最新版本">{versionInfo.latestVersion}</Descriptions.Item>
          </Descriptions>
          <Paragraph type="secondary" style={{ marginTop: 16 }}>
            安装路径: {versionInfo.npmPath}
          </Paragraph>
        </Card>
      );
    }

    if (versionInfo.installed && !versionInfo.isLatest) {
      return (
        <Card style={{ textAlign: 'center', padding: 20 }}>
          <ExclamationCircleOutlined style={{ fontSize: 48, color: '#faad14' }} />
          <Title level={4} style={{ marginTop: 16 }}>发现新版本</Title>
          <Descriptions style={{ marginTop: 16 }} bordered size="small">
            <Descriptions.Item label="当前版本">{versionInfo.currentVersion}</Descriptions.Item>
            <Descriptions.Item label="最新版本">
              <Tag color="blue">{versionInfo.latestVersion}</Tag>
            </Descriptions.Item>
          </Descriptions>
          <Paragraph type="secondary" style={{ marginTop: 16 }}>
            安装路径: {versionInfo.npmPath}
          </Paragraph>
          <Button type="primary" size="large" icon={<SyncOutlined />} onClick={handleUpgrade} style={{ marginTop: 16 }}>
            升级到最新版本
          </Button>
        </Card>
      );
    }

    return (
      <Card style={{ textAlign: 'center', padding: 20 }}>
        <ExclamationCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
        <Title level={4} style={{ marginTop: 16 }}>未安装 OpenClaw</Title>
        <Paragraph type="secondary">
          {versionInfo.message || '请先安装 OpenClaw'}
        </Paragraph>
      </Card>
    );
  };

  const renderLogCard = () => {
    if (logs.length === 0) return null;

    return (
      <Card style={{ marginTop: 16 }}>
        <Title level={5}>操作日志</Title>
        <Card
          style={{
            background: '#1e1e1e',
            color: '#d4d4d4',
            fontFamily: 'Consolas, monospace',
            maxHeight: 250,
            overflow: 'auto'
          }}
        >
          {logs.map((log, i) => {
            const levelColors = {
              'INFO': '#4fc3f7',
              'WARN': '#ffb74d',
              'ERROR': '#ef5350'
            };
            return (
              <div key={i}>
                <Text style={{ color: '#888' }}>[{log.time}]</Text>
                <Text style={{ color: levelColors[log.level] || '#d4d4d4', marginLeft: 8 }}>
                  [{log.level}]
                </Text>
                <Text style={{ color: '#d4d4d4', marginLeft: 8 }}>{log.msg}</Text>
              </div>
            );
          })}
          {installing && <Spin indicator={<LoadingOutlined style={{ color: '#fff' }} />} />}
        </Card>
        {installing && (
          <Progress percent={progress} status="active" style={{ marginTop: 16 }} />
        )}
      </Card>
    );
  };

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Title level={2}>版本检测与升级</Title>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button icon={<SyncOutlined />} onClick={checkVersion} loading={checking}>
            刷新检测
          </Button>
        </Space>

        <Divider style={{ margin: '16px 0' }} />

        {checking && !versionInfo ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 48 }} />} />
            <Paragraph style={{ marginTop: 16 }}>正在检测 OpenClaw 版本...</Paragraph>
          </div>
        ) : (
          renderVersionCard()
        )}

        {renderLogCard()}

        {!installing && versionInfo?.installed && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Button onClick={() => window.location.href = '/operations'}>
              前往运营页面
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export default Install;