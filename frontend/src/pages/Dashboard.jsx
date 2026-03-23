import React from 'react';
import { Card, Row, Col, Typography, Steps, Button, Space, Tag, Alert } from 'antd';
import {
  DownloadOutlined,
  SettingOutlined,
  MonitorOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

function Dashboard() {
  const navigate = useNavigate();

  const steps = [
    {
      title: '安装OpenClaw',
      icon: <DownloadOutlined style={{ fontSize: 32 }} />,
      description: '下载并安装OpenClaw核心组件',
      details: [
        '点击"OpenClaw安装"菜单',
        '检查网络连接和npm registry',
        '点击"一键安装"按钮',
        '等待安装完成'
      ],
      route: '/openclaw-install',
      color: '#1890ff'
    },
    {
      title: '配置向导',
      icon: <SettingOutlined style={{ fontSize: 32 }} />,
      description: '使用向导完成OpenClaw配置',
      details: [
        '激活邀请码获取API配置',
        '自动检测系统环境',
        '选择推荐配置模板',
        '自定义配置参数'
      ],
      route: '/wizard',
      color: '#faad14'
    },
    {
      title: '运行监控',
      icon: <MonitorOutlined style={{ fontSize: 32 }} />,
      description: '实时监控OpenClaw运行状态',
      details: [
        '查看系统资源使用情况',
        '监控OpenClaw服务状态',
        '启动/停止/重启服务',
        '查看控制台链接'
      ],
      route: '/runtime-monitor',
      color: '#722ed1'
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <Title level={2} style={{ marginBottom: 16 }}>
          OpenClaw智能配置系统
        </Title>
        <Paragraph style={{ fontSize: 16, color: '#666', maxWidth: 800, margin: '0 auto' }}>
          简单三步完成OpenClaw配置，让AI智能配置变得轻松简单
        </Paragraph>
      </div>

      <Alert
        message="快速开始"
        description="按照以下步骤操作，快速完成OpenClaw的配置和部署"
        type="info"
        showIcon
        style={{ marginBottom: 32 }}
        icon={<PlayCircleOutlined />}
      />

      <Card 
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span>基础操作流程</span>
          </Space>
        }
      >
        <Row gutter={[24, 24]}>
          {steps.map((step, index) => (
            <Col xs={24} md={8} lg={8} key={index}>
              <Card
                hoverable
                style={{ 
                  height: '100%',
                  borderTop: `4px solid ${step.color}`,
                  transition: 'all 0.3s'
                }}
                bodyStyle={{ padding: '20px' }}
                onClick={() => navigate(step.route)}
              >
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ 
                    width: 64, 
                    height: 64, 
                    borderRadius: '50%', 
                    background: step.color + '20',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    color: step.color
                  }}>
                    {step.icon}
                  </div>
                  <Tag color={step.color} style={{ marginBottom: 8 }}>
                    步骤 {index + 1}
                  </Tag>
                  <Title level={4} style={{ marginBottom: 8 }}>
                    {step.title}
                  </Title>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                    {step.description}
                  </Text>
                </div>
                
                <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '8px' }}>
                  <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                    操作步骤：
                  </Text>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                    {step.details.map((detail, idx) => (
                      <li key={idx} style={{ marginBottom: 4, color: '#666' }}>
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button 
                  type="primary" 
                  block 
                  style={{ 
                    marginTop: 16,
                    background: step.color,
                    borderColor: step.color
                  }}
                  icon={<ArrowRightOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(step.route);
                  }}
                >
                  前往操作
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}

export default Dashboard;