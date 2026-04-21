import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Space, message, Typography, Divider, Tag, Modal, Timeline } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, DownloadOutlined, ReloadOutlined, PlayCircleOutlined, CloudUploadOutlined, StopOutlined } from '@ant-design/icons';
import localLauncherService from '../services/localLauncherService';
import launcherService from '../services/launcherService';

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
  const [operationLogs, setOperationLogs] = useState([]);

  const addLog = (type, text) => {
    setOperationLogs(prev => [...prev, { type, text, time: new Date().toLocaleTimeString() }]);
  };

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
    setOperationLogs([]);
    addLog('info', '开始安装 OpenClaw...');

    try {
      const result = await localLauncherService.installOpenClaw();
      setActionResult(result);

      if (result.success) {
        addLog('success', '安装成功！');
        message.success('安装成功！');
        await checkStatus();
      } else {
        addLog('error', '安装失败: ' + (result.error || '未知错误'));
        message.error('安装失败: ' + (result.error || '未知错误'));
      }
    } catch (err) {
      addLog('error', '安装失败: ' + err.message);
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
    setOperationLogs([]);
    addLog('info', '开始升级 OpenClaw...');

    try {
      const result = await localLauncherService.upgradeOpenClaw();
      setActionResult(result);

      if (result.success) {
        addLog('success', '升级成功！');
        message.success('升级成功！');
        await checkStatus();
      } else {
        addLog('error', '升级失败: ' + (result.error || '未知错误'));
        message.error('升级失败: ' + (result.error || '未知错误'));
      }
    } catch (err) {
      addLog('error', '升级失败: ' + err.message);
      message.error('升级失败: ' + err.message);
      setActionResult({ success: false, error: err.message });
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
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            Modal.confirm({
              title: '升级 OpenClaw CLI',
              content: '确定要升级 OpenClaw CLI 吗？升级可能需要管理员权限。',
              okText: '确定升级',
              cancelText: '取消',
              onOk: () => handleUpgrade()
            });
          }}
          loading={actionLoading}
          size="large"
        >
          升级 OpenClaw CLI
        </Button>

        <Button
          icon={<CloudUploadOutlined />}
          onClick={async () => {
            const changelogResult = await launcherService.getChangelog();
            let content = '升级前请先关闭当前运行的 Launcher 程序（右键点击托盘图标，选择"退出"），然后再点击确定下载新版本。';

            if (changelogResult.success && changelogResult.versions && changelogResult.versions.length > 0) {
              const latest = changelogResult.versions[0];
              content = (
                <div>
                  <p style={{ marginBottom: 8 }}>升级前请先关闭当前运行的 Launcher 程序（右键点击托盘图标，选择"退出"），然后再点击确定下载新版本。</p>
                  <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, marginTop: 12 }}>
                    <strong>v{latest.version} 更新日志</strong>
                    {latest.changes.map((change, idx) => (
                      <div key={idx} style={{ marginTop: 8 }}>
                        <Tag color={change.type === '新增' ? 'green' : change.type === '修复' ? 'red' : 'blue'}>{change.type}</Tag>
                        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                          {change.items.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            Modal.confirm({
              title: '升级 Launcher',
              content,
              okText: '我已关闭，继续下载',
              cancelText: '取消',
              width: 500,
              onOk: () => {
                window.open('http://134.175.18.139:3001/OpenClaw-Launcher-v1.0.3.exe', '_blank');
              }
            });
          }}
        >
          升级 Launcher（本程序）
        </Button>
      </Space>
    );
  };

  const renderOperationLogs = () => {
    if (operationLogs.length === 0) return null;

    return (
      <div style={{ marginTop: 16, background: '#1e1e1e', padding: 16, borderRadius: 8, maxHeight: 200, overflow: 'auto' }}>
        <Text style={{ color: '#fff', fontSize: 12 }}>操作日志：</Text>
        <div style={{ marginTop: 8 }}>
          {operationLogs.map((log, index) => (
            <div key={index} style={{ color: log.type === 'error' ? '#ff6b6b' : log.type === 'success' ? '#51cf66' : '#fff', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: '#888' }}>[{log.time}]</span> {log.text}
            </div>
          ))}
        </div>
      </div>
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
        {renderOperationLogs()}
        {renderActionResult()}
      </Card>
    </div>
  );
};

export default OpenClawInstall;