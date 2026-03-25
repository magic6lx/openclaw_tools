import React from 'react';
import { Card, Button, Typography, Space, Result } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useLauncher } from './LauncherProvider';

const { Text, Title, Paragraph } = Typography;

const LauncherBlocker = () => {
  const { refreshLauncherStatus, launcherStatus } = useLauncher();

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/OpenClaw-Launcher.exe';
    link.download = 'OpenClaw-Launcher.exe';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRetry = () => {
    refreshLauncherStatus();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#f5f5f5',
      padding: 20
    }}>
      <Card style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
        <Result
          status="warning"
          title="OpenClaw Launcher 未运行"
          subTitle="请先运行 Launcher 才能使用本系统"
        />
        
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'left' }}>
            <Paragraph>
              <Text strong>为什么需要 Launcher？</Text>
            </Paragraph>
            <ul style={{ paddingLeft: 20, color: '#666' }}>
              <li>检测本地 OpenClaw 安装状态</li>
              <li>启动和管理 OpenClaw 服务</li>
              <li>实现浏览器无法直接访问的本地功能</li>
            </ul>
          </div>

          <div style={{ textAlign: 'left' }}>
            <Paragraph>
              <Text strong>状态信息：</Text>
            </Paragraph>
            <ul style={{ paddingLeft: 20, color: '#666' }}>
              <li>Launcher 运行状态: {launcherStatus?.available === false ? '未运行' : '未知'}</li>
              <li>OpenClaw 安装: {launcherStatus?.installed === true ? '已安装' : '未检测到'}</li>
              <li>Gateway 状态: {launcherStatus?.gatewayRunning === true ? '运行中' : '未启动'}</li>
            </ul>
          </div>

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Button 
              type="primary" 
              size="large" 
              icon={<DownloadOutlined />}
              onClick={handleDownload}
              block
            >
              下载并安装 OpenClaw Launcher
            </Button>
            
            <Button 
              icon={<ReloadOutlined />}
              onClick={handleRetry}
              block
            >
              已安装？点击重试
            </Button>
          </Space>

          <Text type="secondary" style={{ fontSize: 12 }}>
            安装后请重新启动本页面
          </Text>
        </Space>
      </Card>
    </div>
  );
};

export default LauncherBlocker;
