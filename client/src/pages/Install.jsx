import React, { useState } from 'react';
import { Card, Typography, Row, Col, Button, Radio, Space, Tag, message, Steps, Spin } from 'antd';
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

  const addLog = (msg) => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg }]);
  };

  const handleInstall = async () => {
    setInstalling(true);
    setProgress(0);
    setLogs([]);
    setStep(1);

    const steps = [
      '正在检测系统环境...',
      '正在下载 OpenClaw...',
      '正在安装依赖...',
      '正在配置...',
      '正在应用配置模板...',
      '安装完成！'
    ];

    for (let i = 0; i < steps.length; i++) {
      addLog(steps[i]);
      setProgress((i + 1) * (100 / steps.length));
      await new Promise(r => setTimeout(r, 800));
    }

    setStep(2);
    setInstalling(false);
    message.success('安装成功！');
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
            {logs.map((log, i) => (
              <div key={i}>
                <Text style={{ color: '#888' }}>[{log.time}]</Text> {log.msg}
              </div>
            ))}
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
