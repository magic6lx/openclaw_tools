import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Typography, Button, Tag, Space, Badge, List, Avatar } from 'antd';
import { ReloadOutlined, UserOutlined, FileTextOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function Dashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ totalClients: 0, totalLogs: 0, todayLogs: 0, onlineClients: 0 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentClients, setRecentClients] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/logs?limit=500`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        const logsData = data.data || [];
        setLogs(logsData);
        
        const uniqueClients = new Set(logsData.map(l => l.device_id));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayLogs = logsData.filter(l => new Date(l.server_timestamp) >= today).length;
        
        setStats({
          totalClients: uniqueClients.size,
          totalLogs: logsData.length,
          todayLogs,
          onlineClients: uniqueClients.size
        });

        const clientMap = new Map();
        logsData.forEach(log => {
          if (!clientMap.has(log.device_id)) {
            clientMap.set(log.device_id, { deviceId: log.device_id, lastSeen: log.server_timestamp, logCount: 0 });
          }
          clientMap.get(log.device_id).logCount++;
        });
        setRecentClients(Array.from(clientMap.values()).slice(0, 5));
      }
    } catch (err) {
      console.error('获取数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const getLogLevelTag = (level) => {
    const colors = { info: 'blue', warn: 'orange', error: 'red', debug: 'gray' };
    return <Tag color={colors[level] || 'blue'}>{level?.toUpperCase() || 'INFO'}</Tag>;
  };

  const columns = [
    { 
      title: '时间', 
      dataIndex: 'server_timestamp', 
      key: 'server_timestamp', 
      width: 180,
      render: t => <Space><ClockCircleOutlined />{t ? new Date(t).toLocaleString() : '-'}</Space>
    },
    { title: '设备ID', dataIndex: 'device_id', key: 'device_id', width: 150, render: id => <Tag><UserOutlined /> {id?.slice(0, 8)}...</Tag> },
    { title: '级别', dataIndex: 'level', key: 'level', width: 80, render: level => getLogLevelTag(level) },
    { title: '日志内容', dataIndex: 'message', key: 'message', ellipsis: true }
  ];

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>OpenClaw 管理后台</Title>
        <Space>
          <Text>欢迎, <strong>{user?.username}</strong></Text>
          <Button onClick={fetchData} icon={<ReloadOutlined />} loading={loading}>刷新</Button>
          <Button onClick={logout}>退出</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="在线客户端" 
              value={stats.onlineClients} 
              valueStyle={{ color: '#52c41a' }}
              prefix={<Badge status="success" />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="总客户端数" 
              value={stats.totalClients} 
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="今日日志" 
              value={stats.todayLogs} 
              valueStyle={{ color: '#1890ff' }}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="日志总数" 
              value={stats.totalLogs} 
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="最近日志" extra={<Button size="small" onClick={fetchData}>刷新</Button>} loading={loading}>
            <Table 
              dataSource={logs.slice(0, 20)} 
              columns={columns} 
              rowKey={(r, i) => `${r.timestamp}-${i}`} 
              pagination={{ pageSize: 10, size: 'small' }}
              size="small"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="最近活跃客户端" loading={loading}>
            <List
              size="small"
              dataSource={recentClients}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />}
                    title={<Tag>{item.deviceId?.slice(0, 12)}...</Tag>}
                    description={`最后活动: ${new Date(item.lastSeen).toLocaleString()}`}
                  />
                  <Text type="secondary">{item.logCount} 条日志</Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
