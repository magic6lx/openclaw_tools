import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Space, message, Typography, Divider, Tag, Progress } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, DownloadOutlined, ReloadOutlined, PlayCircleOutlined, CloudUploadOutlined } from '@ant-design/icons';
import localLauncherService from '../services/localLauncherService';

const { Title, Text, Paragraph } = Typography;

const OpenClawInstall = () => {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [systemCheck, setSystemCheck] = useState(null);
  const [status, setStatus] = useState({
    launcherAvailable: false,
    openclawInstalled: false,
    gatewayRunning: false,
    openclawVersion: null
  });
  const [actionResult, setActionResult] = useState(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const [launcherStatus, launcherSysInfo] = await Promise.all([
        localLauncherService.checkOpenClawStatus(),
        localLauncherService.getSystemInfo()
      ]);

      const launcherAvailable = launcherStatus.available;
      const openclawInstalled = launcherSysInfo?.openclawInstalled || false;
      const gatewayRunning = launcherSysInfo?.gatewayRunning || false;
      const openclawVersion = launcherSysInfo?.openclawVersion || null;

      setStatus({
        launcherAvailable,
        openclawInstalled,
        gatewayRunning,
        openclawVersion
      });

      setSystemCheck({
        platform: launcherSysInfo?.platform || launcherStatus.platform || 'unknown',
        arch: launcherSysInfo?.arch || launcherStatus.arch || 'unknown',
        nodeVersion: launcherSysInfo?.nodeVersion || null,
        npmVersion: launcherSysInfo?.npmVersion || null,
        diskSpace: launcherSysInfo?.diskSpaceGb || null,
        openclawVersion: launcherSysInfo?.openclawVersion || launcherStatus.version || null
      });
    } catch (err) {
      message.error('检查状态失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (!status.launcherAvailable) {
      message.error('Launcher未运行，请先运行OpenClaw Launcher');
      return;
    }

    setActionLoading(true);
    setActionResult(null);

    try {
      const result = await localLauncherService.installOpenClaw();
      setActionResult(result);

      if (result.success) {
        message.success('安装成功！');
        await checkStatus();
      } else {
        message.error('安装失败: ' + (result.error || '未知错误'));
      }
    } catch (err) {
      message.error('安装失败: ' + err.message);
      setActionResult({ success: false, error: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!status.launcherAvailable) {
      message.error('Launcher未运行，请先运行OpenClaw Launcher');
      return;
    }

    setActionLoading(true);
    setActionResult(null);

    try {
      const result = await localLauncherService.upgradeOpenClaw();
      setActionResult(result);

      if (result.success) {
        message.success('升级成功！');
        await checkStatus();
      } else {
        message.error('升级失败: ' + (result.error || '未知错误'));
      }
    } catch (err) {
      message.error('升级失败: ' + err.message);
      setActionResult({ success: false, error: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLaunch = async () => {
    if (!status.launcherAvailable) {
      message.error('Launcher未运行');
      return;
    }

    setActionLoading(true);

    try {
      const result = await localLauncherService.launchOpenClaw();
      if (result.success) {
        message.success('OpenClaw 启动命令已发送');
        setTimeout(checkStatus, 2000);
      } else {
        message.error('启动失败: ' + (result.error || '未知错误'));
      }
    } catch (err) {
      message.error('启动失败: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatusTags = () => {
    const tags = [];

    if (status.launcherAvailable) {
      tags.push(<Tag key="launcher" color="blue" icon={<CheckCircleOutlined />}>Launcher 运行中</Tag>);
    } else {
      tags.push(<Tag key="launcher" color="red" icon={<CloseCircleOutlined />}>Launcher 未运行</Tag>);
    }

    if (status.openclawInstalled) {
      tags.push(<Tag key="openclaw" color="green" icon={<CheckCircleOutlined />}>OpenClaw 已安装 (v{status.openclawVersion})</Tag>);
    } else {
      tags.push(<Tag key="openclaw" color="orange" icon={<CloseCircleOutlined />}>OpenClaw 未安装</Tag>);
    }

    if (status.gatewayRunning) {
      tags.push(<Tag key="gateway" color="green" icon={<CheckCircleOutlined />}>Gateway 运行中</Tag>);
    } else {
      tags.push(<Tag key="gateway" color="gray" icon={<CloseCircleOutlined />}>Gateway 未启动</Tag>);
    }

    return tags;
  };

  const renderSystemInfo = () => {
    if (!systemCheck) return null;

    const items = [];

    if (systemCheck.nodeVersion) {
      items.push(<Text key="node">Node.js: <Text code>{systemCheck.nodeVersion}</Text></Text>);
    }

    if (systemCheck.npmVersion) {
      items.push(<Text key="npm">npm: <Text code>{systemCheck.npmVersion}</Text></Text>);
    }

    if (systemCheck.platform) {
      items.push(<Text key="platform">{systemCheck.platform} ({systemCheck.arch})</Text>);
    }

    if (systemCheck.diskSpace) {
      items.push(<Text key="disk">磁盘: {systemCheck.diskSpace.toFixed(1)}GB可用</Text>);
    }

    return (
      <Space size="large" wrap>
        {items}
      </Space>
    );
  };

  const renderActionButtons = () => {
    if (!status.launcherAvailable) {
      return (
        <Alert
          type="warning"
          message="Launcher 未运行"
          description="请先下载并运行 OpenClaw Launcher，然后刷新此页面"
        />
      );
    }

    if (!status.openclawInstalled) {
      return (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text>点击下方按钮一键安装 OpenClaw（包含 Node.js 等依赖）</Text>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleInstall}
            loading={actionLoading}
            size="large"
          >
            一键安装 OpenClaw
          </Button>
        </Space>
      );
    }

    return (
      <Space size="middle" wrap>
        {!status.gatewayRunning && (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleLaunch}
            loading={actionLoading}
            size="large"
          >
            启动服务
          </Button>
        )}

        <Button
          icon={<ReloadOutlined />}
          onClick={handleUpgrade}
          loading={actionLoading}
          size="large"
        >
          升级 OpenClaw CLI
        </Button>

        <Button
          icon={<CloudUploadOutlined />}
          onClick={async () => {
            message.info('请手动下载新版 Launcher 安装包来升级');
          }}
          loading={actionLoading}
        >
          升级 Launcher（本程序）
        </Button>
      </Space>
    );
  };

  const renderActionResult = () => {
    if (!actionResult) return null;

    if (actionResult.success) {
      return (
        <Alert
          type="success"
          message="操作成功"
          description={actionResult.message || actionResult.error || '操作已完成'}
          style={{ marginTop: 16 }}
          showIcon
        />
      );
    }

    return (
      <Alert
        type="error"
        message="操作失败"
        description={actionResult.error || '请查看错误信息'}
        style={{ marginTop: 16 }}
        showIcon
      />
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      <Title level={2}>OpenClaw 安装与升级</Title>

      <Card
        style={{ marginBottom: 16 }}
        extra={
          <Button icon={<ReloadOutlined />} onClick={checkStatus} loading={loading}>
            刷新状态
          </Button>
        }
      >
        <Space size="middle" wrap style={{ marginBottom: 16 }}>
          {renderStatusTags()}
        </Space>

        <Divider style={{ margin: '12px 0' }} />

        {renderSystemInfo()}
      </Card>

      <Card title="操作">
        {renderActionButtons()}
        {renderActionResult()}
      </Card>
    </div>
  );
};

export default OpenClawInstall;