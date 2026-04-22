import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Typography, Space, Button, Tag } from 'antd';

const { Title } = Typography;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function Dashboard() {
  const [stats, setStats] = useState({ totalClients: 0, totalLogs: 0 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/logs?limit=100`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
        setStats({ totalClients: new Set(data.logs.map(l => l.deviceId)).size, totalLogs: data.logs.length });
      }
    } catch (err) {
      console.error('获取日志失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const columns = [
    { title: '设备ID', dataIndex: 'deviceId', key: 'deviceId', width: 150 },
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', render: t => new Date(t).toLocaleString() },
    { title: '日志', dataIndex: 'message', key: 'message', ellipsis: true }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>OpenClaw 管理后台</Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card><Statistic title="在线客户端" value={stats.totalClients} /></Card>
        </Col>
        <Col span={12}>
          <Card><Statistic title="日志总数" value={stats.totalLogs} /></Card>
        </Col>
      </Row>
      <Card title="最近日志" extra={<Button onClick={fetchLogs}>刷新</Button>}>
        <Table dataSource={logs} columns={columns} rowKey="timestamp" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  );
}

export default Dashboard;
