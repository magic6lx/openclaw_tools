import React, { useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Table, Select, Space, Progress } from 'antd';
import { UserOutlined, FileTextOutlined, RiseOutlined } from '@ant-design/icons';
import { Area, Column, Pie } from '@ant-design/charts';

const { Title, Text } = Typography;

function Statistics() {
  const [timeRange, setTimeRange] = useState('7d');

  const trendData = [
    { date: '04-16', logs: 120, clients: 15 },
    { date: '04-17', logs: 180, clients: 18 },
    { date: '04-18', logs: 150, clients: 17 },
    { date: '04-19', logs: 220, clients: 22 },
    { date: '04-20', logs: 280, clients: 25 },
    { date: '04-21', logs: 350, clients: 28 },
    { date: '04-22', logs: 400, clients: 32 },
  ];

  const categoryData = [
    { category: '基础配置', value: 156 },
    { category: '标准配置', value: 89 },
    { category: '高级配置', value: 45 },
  ];

  const recentUsers = [
    { id: 1, username: 'user1@example.com', lastLogin: '2026-04-22 10:30', template: '基础配置' },
    { id: 2, username: 'user2@example.com', lastLogin: '2026-04-22 09:15', template: '标准配置' },
    { id: 3, username: 'user3@example.com', lastLogin: '2026-04-21 18:40', template: '高级配置' },
    { id: 4, username: 'user4@example.com', lastLogin: '2026-04-21 14:20', template: '基础配置' },
  ];

  const trendConfig = {
    data: trendData,
    xField: 'date',
    yField: 'logs',
    smooth: true,
    areaStyle: { fill: 'l(270) 0:#1890ff00 1:#1890ff' },
  };

  const columnConfig = {
    data: trendData,
    xField: 'date',
    yField: 'clients',
    color: '#52c41a',
  };

  const pieConfig = {
    data: categoryData,
    angleField: 'value',
    colorField: 'category',
    radius: 0.8,
    label: { text: 'value', position: 'outside' },
  };

  const columns = [
    { title: '用户', dataIndex: 'username' },
    { title: '最后登录', dataIndex: 'lastLogin' },
    { title: '使用模板', dataIndex: 'template' },
  ];

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={2}>统计分析</Title>
        <Space>
          <Select value={timeRange} onChange={setTimeRange} style={{ width: 120 }}>
            <Select.Option value="7d">最近7天</Select.Option>
            <Select.Option value="30d">最近30天</Select.Option>
            <Select.Option value="90d">最近90天</Select.Option>
          </Select>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card><Statistic title="总用户数" value={156} prefix={<UserOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="今日活跃" value={32} prefix={<UserOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="总日志数" value={12890} prefix={<FileTextOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="今日新增日志" value={400} prefix={<RiseOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={16}>
          <Card title="日志趋势">
            <Area {...trendConfig} style={{ height: 250 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="模板使用分布">
            <Pie {...pieConfig} style={{ height: 250 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="活跃用户趋势">
            <Column {...columnConfig} style={{ height: 200 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Token使用情况">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div><Text>已用 / 总量</Text><Progress percent={45} format={() => '45,000 / 100,000'} /></div>
              <div><Text>请求次数</Text><Progress percent={32} status="active" /></div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="最近活跃用户" style={{ marginTop: 16 }}>
        <Table dataSource={recentUsers} columns={columns} rowKey="id" pagination={false} size="small" />
      </Card>
    </div>
  );
}

export default Statistics;
