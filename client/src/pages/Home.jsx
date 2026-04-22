import React from 'react';
import { Card, Typography, Row, Col, Button, Space, Statistic, Tag } from 'antd';
import { DownloadOutlined, SettingOutlined, PlayCircleOutlined, StopOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

function Home() {
  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Title level={2}>OpenClaw 运维工具</Title>
      
      <Card style={{ marginBottom: 24 }}>
        <Title level={4}><InfoCircleOutlined /> 系统说明</Title>
        <Paragraph>
          OpenClaw 是一个强大的运维管理工具，帮助您快速完成 OpenClaw 的安装、配置和日常运营。
          本系统提供一键安装、智能配置、日常运营等功能，让运维工作更加简单高效。
        </Paragraph>
      </Card>

      <Title level={4}>快捷入口</Title>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card 
            hoverable 
            style={{ textAlign: 'center', padding: 24 }}
            cover={<SettingOutlined style={{ fontSize: 48, color: '#1890ff', marginTop: 20 }} />}
          >
            <Title level={5}>安装及配置</Title>
            <Paragraph type="secondary">一键安装OpenClaw，选择配置模板</Paragraph>
            <Link to="/install">
              <Button type="primary" icon={<DownloadOutlined />}>立即安装</Button>
            </Link>
          </Card>
        </Col>
        
        <Col span={8}>
          <Card 
            hoverable 
            style={{ textAlign: 'center', padding: 24 }}
            cover={<PlayCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginTop: 20 }} />}
          >
            <Title level={5}>日常运营</Title>
            <Paragraph type="secondary">管理OpenClaw启动和停止</Paragraph>
            <Link to="/operations">
              <Button type="primary" icon={<PlayCircleOutlined />}>开始运营</Button>
            </Link>
          </Card>
        </Col>
        
        <Col span={8}>
          <Card 
            hoverable 
            style={{ textAlign: 'center', padding: 24 }}
            cover={<SettingOutlined style={{ fontSize: 48, color: '#722ed1', marginTop: 20 }} />}
          >
            <Title level={5}>配置管理</Title>
            <Paragraph type="secondary">查看和管理当前配置</Paragraph>
            <Link to="/config">
              <Button>查看配置</Button>
            </Link>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 24 }}>
        <Title level={5}>系统状态</Title>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="Launcher状态" value="运行中" valueStyle={{ color: '#52c41a' }} />
          </Col>
          <Col span={6}>
            <Statistic title="OpenClaw状态" value="未检测" valueStyle={{ color: '#999' }} />
          </Col>
          <Col span={6}>
            <Statistic title="服务端连接" value="已连接" valueStyle={{ color: '#52c41a' }} />
          </Col>
          <Col span={6}>
            <Statistic title="版本" value="1.0.0" />
          </Col>
        </Row>
      </Card>
    </div>
  );
}

export default Home;
