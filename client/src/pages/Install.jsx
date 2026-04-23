import React, { useState } from 'react';
import { Card, Typography, Row, Col, Button, Radio, Space, Tag, message, Steps, Spin, Progress } from 'antd';
import { DownloadOutlined, CheckCircleOutlined, LoadingOutlined, RocketOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const CONFIG_TEMPLATES = [
  { 
    id: 'basic', 
    name: '基础配置', 
    description: '适合入门用户，默认配置，开箱即用',
    tags: ['基础', '推荐'],
    icon: '🚀'
  },
  { 
    id: 'standard', 
    name: '标准配置', 
    description: '包含常用功能配置，适合大多数用户',
    tags: ['标准'],
    icon: '⚡'
  },
  { 
    id: 'advanced', 
    name: '高级配置', 
    description: '完整功能配置，适合高级用户',
    tags: ['高级'],
    icon: '🔥'
  }
];

function Install() {
  const [step, setStep] = useState(0);
  const [selectedConfig, setSelectedConfig] = useState('basic');
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
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
        setStep(2);
        if (data.logs?.some(l => l.level === 'ERROR')) {
          message.error('安装失败，请查看日志');
        } else {
          message.success('安装成功！');
        }
      }
    } catch (err) {
      console.error('获取安装状态失败:', err);
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    setProgress(10);
    setLogs([]);
    setStep(1);
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

      addLog('INFO', '安装已启动，等待完成...');
      setProgress(30);

      const interval = setInterval(fetchInstallStatus, 2000);
      setStatusInterval(interval);

    } catch (err) {
      addLog('ERROR', `连接Launcher失败: ${err.message}`);
      addLog('ERROR', '请确保Launcher正在运行');
      setInstalling(false);
    }
  };

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Title level={2}>安装及配置</Title>

      <Steps current={step} style={{ marginBottom: 24 }}>
        <Steps.Step title="选择配置" />
        <Steps.Step title="执行安装" />
        <Steps.Step title="完成" />
      </Steps>

      {step === 0 && (
        <Card>
          <Title level={4}>选择配置模板</Title>
          <Paragraph type="secondary">选择适合您的配置模板，然后点击安装</Paragraph>
          
          <Radio.Group 
            value={selectedConfig} 
            onChange={e => setSelectedConfig(e.target.value)}
            style={{ width: '100%' }}
          >
            <Row gutter={[16, 16]}>
              {CONFIG_TEMPLATES.map(t => (
                <Col span={8} key={t.id}>
                  <Card 
                    hoverable
                    style={{ 
                      border: selectedConfig === t.id ? '2px solid #1890ff' : '1px solid #e8e8e8',
                      background: selectedConfig === t.id ? '#f0f7ff' : '#fff'
                    }}
                  >
                    <Radio value={t.id}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Text style={{ fontSize: 24 }}>{t.icon}</Text>
                        <Title level={5} style={{ margin: 0 }}>{t.name}</Title>
                        <Paragraph type="secondary" style={{ margin: 0 }}>{t.description}</Paragraph>
                        <Space>
                          {t.tags.map(tag => <Tag key={tag} color={tag === '推荐' ? 'blue' : 'default'}>{tag}</Tag>)}
                        </Space>
                      </Space>
                    </Radio>
                  </Card>
                </Col>
              ))}
            </Row>
          </Radio.Group>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <Button 
              type="primary" 
              size="large" 
              icon={<DownloadOutlined />} 
              onClick={handleInstall}
            >
              开始安装
            </Button>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <Title level={4}>正在安装...</Title>
          <div style={{ marginBottom: 16 }}>
            <Progress percent={progress} status="active" />
          </div>
          <Card
            style={{
              background: '#1e1e1e',
              color: '#d4d4d4',
              fontFamily: 'Consolas, monospace',
              maxHeight: 300,
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
        </Card>
      )}

      {step === 2 && (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
          <Title level={3} style={{ marginTop: 16 }}>安装完成！</Title>
          <Paragraph type="secondary">OpenClaw 已成功安装并配置</Paragraph>
          <Space style={{ marginTop: 24 }}>
            <Button type="primary" icon={<RocketOutlined />} onClick={() => setStep(0)}>
              重新安装
            </Button>
            <Button onClick={() => window.location.href = '/operations'}>
              前往运营
            </Button>
          </Space>
        </Card>
      )}
    </div>
  );
}

export default Install;
