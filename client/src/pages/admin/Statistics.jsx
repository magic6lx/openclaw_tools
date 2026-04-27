import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, Table, Select, Space, Progress, Spin } from 'antd';
import { UserOutlined, FileTextOutlined, RiseOutlined, DollarOutlined } from '@ant-design/icons';
import { Area, Column, Pie } from '@ant-design/charts';

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function Statistics() {
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(false);
  const [trendData, setTrendData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [stats, setStats] = useState({ totalUsers: 0, activeToday: 0, totalLogs: 0, todayLogs: 0 });
  const [tokenStats, setTokenStats] = useState({ total: 0, used: 0, remaining: 0, requestCount: 0 });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        const [logsRes, devicesRes, tokenRes] = await Promise.all([
          fetch(`${API_BASE}/api/logs?limit=5000`, { headers }).then(r => r.json()),
          fetch(`${API_BASE}/api/devices`, { headers }).then(r => r.json()),
          fetch(`${API_BASE}/api/proxy/usage`, { headers }).then(r => r.json()).catch(() => ({ success: false }))
        ]);

        if (tokenRes.success) {
          setTokenStats({
            total: tokenRes.data.total || 0,
            used: tokenRes.data.used || 0,
            remaining: tokenRes.data.remaining || 0,
            requestCount: tokenRes.data.requestCount || 0
          });
        }

        let totalLogs = 0;
        let todayLogs = 0;
        let totalUsers = 0;
        let activeToday = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (logsRes.success) {
          const logsData = logsRes.data || [];
          totalLogs = logsData.length;
          
          const trendMap = new Map();
          logsData.forEach(log => {
            const d = new Date(log.timestamp || log.server_timestamp || Date.now());
            if (d >= today) todayLogs++;
            
            const dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!trendMap.has(dateStr)) {
              trendMap.set(dateStr, { date: dateStr, logs: 0, clients: new Set() });
            }
            const entry = trendMap.get(dateStr);
            entry.logs += 1;
            if (log.device_id) entry.clients.add(log.device_id);
          });
          const tData = Array.from(trendMap.values())
            .map(e => ({ date: e.date, logs: e.logs, clients: e.clients.size }))
            .sort((a,b) => a.date.localeCompare(b.date));
          setTrendData(tData.length > 0 ? tData : [{ date: '今天', logs: 0, clients: 0 }]);
        }

        if (devicesRes.success) {
          const devicesData = devicesRes.data || [];
          totalUsers = devicesData.length;
          
          // Category Data (OS Types)
          const osMap = new Map();
          devicesData.forEach(d => {
            const dTime = new Date(d.last_seen || 0);
            if (dTime >= today) activeToday++;

            const os = d.os_type || 'Unknown';
            osMap.set(os, (osMap.get(os) || 0) + 1);
          });
          const cData = Array.from(osMap.entries()).map(([category, value]) => ({ category, value }));
          setCategoryData(cData.length ? cData : [{ category: '无设备', value: 1 }]);

          // Recent Users Data
          const rUsers = devicesData
            .sort((a, b) => new Date(b.last_seen || 0) - new Date(a.last_seen || 0))
            .slice(0, 10)
            .map(d => ({
              id: d.id || d.device_id,
              username: d.device_name || d.device_id || 'Unknown',
              lastLogin: d.last_seen ? new Date(d.last_seen).toLocaleString() : 'N/A',
              template: d.os_type || '未知OS'
            }));
          setRecentUsers(rUsers);
        }
        
        setStats({ totalUsers, activeToday, totalLogs, todayLogs });
      } catch (err) {
        console.error('获取统计数据失败:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

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
    <Spin spinning={loading}>
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
          <Card><Statistic title="总用户数" value={stats.totalUsers} prefix={<UserOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="今日活跃" value={stats.activeToday} prefix={<UserOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="总日志数" value={stats.totalLogs} prefix={<FileTextOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="今日新增日志" value={stats.todayLogs} prefix={<RiseOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Token配额" value={tokenStats.total} prefix={<DollarOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已使用" value={tokenStats.used} valueStyle={{ color: tokenStats.used / tokenStats.total > 0.9 ? '#ff4d4f' : '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="剩余配额" value={tokenStats.remaining} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">Token使用进度</Text>
            <Progress
              percent={tokenStats.total > 0 ? Math.round((tokenStats.used / tokenStats.total) * 100) : 0}
              status={tokenStats.used / tokenStats.total > 0.9 ? 'exception' : 'active'}
              format={p => `${tokenStats.used} / ${tokenStats.total}`}
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={16}>
          <Card title="日志趋势">
            <Area {...trendConfig} style={{ height: 250 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="设备系统分布">
            <Pie {...pieConfig} style={{ height: 250 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="活跃用户趋势">
            <Column {...columnConfig} style={{ height: 200 }} />
          </Card>
        </Col>
      </Row>

      <Card title="最近活跃用户" style={{ marginTop: 16 }}>
        <Table dataSource={recentUsers} columns={columns} rowKey="id" pagination={false} size="small" />
      </Card>
      </div>
    </Spin>
  );
}

export default Statistics;
