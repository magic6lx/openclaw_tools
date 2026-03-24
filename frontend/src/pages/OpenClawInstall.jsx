import React, { useState, useEffect } from 'react';
import { Card, Button, Steps, Alert, Descriptions, Tag, Space, message, Spin, Typography, List } from 'antd';
import { CheckCircleOutlined, DownloadOutlined, ExclamationCircleOutlined, InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import openClawGatewayService from '../services/openClawGatewayService';

const { Step } = Steps;
const { Title, Paragraph, Text } = Typography;

const OpenClawInstall = () => {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [systemCheck, setSystemCheck] = useState(null);
  const [installStatus, setInstallStatus] = useState('idle');
  const [installResult, setInstallResult] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    initGateway();

    openClawGatewayService.on('installProgress', (data) => {
      if (data.progress) setProgress(data.progress);
      if (data.message) message.info(data.message);
    });

    return () => {
      openClawGatewayService.off('installProgress');
    };
  }, []);

  const initGateway = async () => {
    setConnecting(true);
    setError(null);

    try {
      await openClawGatewayService.connect();
      setConnected(true);
      await checkSystem();
    } catch (err) {
      setConnected(false);
      setError('无法连接到OpenClaw Gateway。请确保OpenClaw已启动。');
    } finally {
      setConnecting(false);
    }
  };

  const checkSystem = async () => {
    if (!connected) return;

    setLoading(true);
    try {
      const result = await openClawGatewayService.checkSystem();
      setSystemCheck(result);
    } catch (err) {
      message.error('系统检查失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (!connected) {
      message.error('Gateway未连接');
      return;
    }

    setInstallStatus('installing');
    setProgress(0);
    setError(null);

    try {
      const result = await openClawGatewayService.installOpenClaw(false);
      setInstallResult(result);
      setInstallStatus('success');
      message.success('安装成功！');
    } catch (err) {
      setInstallStatus('error');
      setError(err.message || '安装失败');
      message.error('安装失败: ' + err.message);
    }
  };

  const handleUpgrade = async () => {
    if (!connected) {
      message.error('Gateway未连接');
      return;
    }

    setInstallStatus('installing');
    setProgress(0);
    setError(null);

    try {
      const result = await openClawGatewayService.installOpenClaw(true);
      setInstallResult(result);
      setInstallStatus('success');
      message.success('升级成功！');
    } catch (err) {
      setInstallStatus('error');
      setError(err.message || '升级失败');
      message.error('升级失败: ' + err.message);
    }
  };

  const handleVerify = async () => {
    if (!connected) {
      message.error('Gateway未连接');
      return;
    }

    setLoading(true);
    try {
      const result = await openClawGatewayService.verifyInstallation();
      setInstallResult(result);
      if (result.installed) {
        message.success('OpenClaw已安装，版本: ' + result.version);
      } else {
        message.info('OpenClaw未安装');
      }
    } catch (err) {
      message.error('验证失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderConnectionStatus = () => {
    if (connecting) {
      return (
        <Card>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip="正在连接OpenClaw Gateway..." />
          </div>
        </Card>
      );
    }

    if (error) {
      return (
        <Card>
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
            action={
              <Button size="small" icon={<ReloadOutlined />} onClick={initGateway}>
                重试
              </Button>
            }
          />
        </Card>
      );
    }

    return null;
  };

  const renderSystemCheck = () => {
    if (!systemCheck) return null;

    const items = [
      {
        label: '操作系统',
        value: `${systemCheck.platform} (${systemCheck.arch})`,
        status: 'success'
      },
      {
        label: 'Node.js版本',
        value: systemCheck.nodeVersion || '未检测到',
        status: systemCheck.nodeVersion ? 'success' : 'error'
      },
      {
        label: 'npm版本',
        value: systemCheck.npmVersion || '未检测到',
        status: systemCheck.npmInstalled ? 'success' : 'error'
      },
      {
        label: '磁盘空间',
        value: systemCheck.diskSpace ? `${systemCheck.diskSpace}GB可用` : '检查失败',
        status: systemCheck.diskSpace > 5 ? 'success' : 'error'
      },
      {
        label: '网络连接',
        value: systemCheck.networkConnection ? '正常' : '异常',
        status: systemCheck.networkConnection ? 'success' : 'error'
      },
      {
        label: 'OpenClaw状态',
        value: systemCheck.openclawInstalled ? `已安装 (v${systemCheck.openclawVersion})` : '未安装',
        status: systemCheck.openclawInstalled ? 'success' : 'warning'
      }
    ];

    return (
      <Card title="系统检查" extra={<Button size="small" icon={<ReloadOutlined />} onClick={checkSystem} loading={loading}>重新检查</Button>}>
        <Descriptions column={2} size="small">
          {items.map((item, index) => (
            <Descriptions.Item
              key={index}
              label={item.label}
            >
              <Space>
                {item.status === 'success' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                {item.status === 'error' && <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                {item.status === 'warning' && <InfoCircleOutlined style={{ color: '#faad14' }} />}
                <Text>{item.value}</Text>
              </Space>
            </Descriptions.Item>
          ))}
        </Descriptions>
      </Card>
    );
  };

  const renderInstallAction = () => {
    if (!systemCheck) return null;

    const isInstalled = systemCheck.openclawInstalled;

    return (
      <Card title="安装操作">
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {installStatus === 'installing' && (
            <div>
              <Text>正在{isInstalled ? '升级' : '安装'}...</Text>
              <div style={{ marginTop: 8 }}>
                <progress value={progress} max="100" style={{ width: '100%' }} />
                <Text type="secondary">{progress}%</Text>
              </div>
            </div>
          )}

          {installStatus === 'error' && error && (
            <Alert
              message="安装失败"
              description={error}
              type="error"
              showIcon
            />
          )}

          {installStatus === 'success' && installResult && (
            <Alert
              message="安装成功"
              description={`OpenClaw ${installResult.version} 已成功${isInstalled ? '升级' : '安装'}`}
              type="success"
              showIcon
            />
          )}

          <Space>
            {!isInstalled ? (
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleInstall}
                loading={installStatus === 'installing'}
                disabled={!connected || loading}
                size="large"
              >
                一键安装
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleUpgrade}
                loading={installStatus === 'installing'}
                disabled={!connected || loading}
                size="large"
              >
                升级OpenClaw
              </Button>
            )}

            <Button
              icon={<CheckCircleOutlined />}
              onClick={handleVerify}
              disabled={!connected || loading}
            >
              验证安装
            </Button>
          </Space>
        </Space>
      </Card>
    );
  };

  const renderDownloadInfo = () => {
    return (
      <Card title="手动下载安装">
        <Paragraph type="secondary">
          如果自动安装失败，您可以手动下载并安装OpenClaw：
        </Paragraph>
        <List size="small" bordered>
          <List.Item>
            <Text>Windows: </Text>
            <Text type="secondary">从服务器下载 OpenClaw-Setup-Windows.exe</Text>
          </List.Item>
          <List.Item>
            <Text>macOS: </Text>
            <Text type="secondary">从服务器下载 OpenClaw-Setup-Mac.dmg</Text>
          </List.Item>
          <List.Item>
            <Text>Linux: </Text>
            <Text type="secondary">从服务器下载 OpenClaw-Setup-Linux.AppImage</Text>
          </List.Item>
        </List>
      </Card>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>OpenClaw 安装</Title>
      <Paragraph type="secondary">
        在您的本地机器上安装或升级OpenClaw
      </Paragraph>

      {renderConnectionStatus()}

      <div style={{ marginTop: 16 }}>
        {renderSystemCheck()}
      </div>

      <div style={{ marginTop: 16 }}>
        {renderInstallAction()}
      </div>

      <div style={{ marginTop: 16 }}>
        {renderDownloadInfo()}
      </div>
    </div>
  );
};

export default OpenClawInstall;