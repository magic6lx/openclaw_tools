import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Button, Tag, Space, Modal, Descriptions, Badge, Empty, Input, Select, message } from 'antd';
import { ReloadOutlined, UserOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientLogs, setClientLogs] = useState([]);
  const [filter, setFilter] = useState('');

  const fetchClients = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/logs?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
        const clientMap = new Map();
        data.logs.forEach(log => {
          if (!clientMap.has(log.deviceId)) {
            clientMap.set(log.deviceId, {
              key: log.deviceId,
              deviceId: log.deviceId,
              firstSeen: log.timestamp,
              lastSeen: log.timestamp,
              logCount: 0,
              levels: new Set(),
              sources: new Set()
            });
          }
          const client = clientMap.get(log.deviceId);
          client.logCount++;
          client.lastSeen = log.timestamp;
          if (log.level) client.levels.add(log.level);
          if (log.source) client.sources.add(log.source);
        });
        setClients(Array.from(clientMap.values()));
      }
    } catch (err) {
      console.error('获取客户端失败:', err);
      message.error('获取客户端列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
    const interval = setInterval(fetchClients, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleViewLogs = (client) => {
    setSelectedClient(client);
    setClientLogs(logs.filter(l => l.deviceId === client.deviceId).reverse());
  };

  const getStatusBadge = (lastSeen) => {
    const diff = Date.now() - new Date(lastSeen).getTime();
    const isOnline = diff < 5 * 60 * 1000;
    return <Badge status={isOnline ? 'success' : 'default'} text={isOnline ? '在线' : '离线'} />;
  };

  const filteredClients = clients.filter(c => 
    !filter || c.deviceId.toLowerCase().includes(filter.toLowerCase())
  );

  const columns = [
    { title: '设备ID', dataIndex: 'deviceId', key: 'deviceId', width: 200, ellipsis: true },
    { 
      title: '状态', 
      dataIndex: 'lastSeen', 
      key: 'status', 
      width: 100,
      render: (t) => getStatusBadge(t)
    },
    { 
      title: '首见时间', 
      dataIndex: 'firstSeen', 
      key: 'firstSeen', 
      width: 180,
      render: t => new Date(t).toLocaleString()
    },
    { 
      title: '最近活动', 
      dataIndex: 'lastSeen', 
      key: 'lastSeen', 
      width: 180,
      render: t => new Date(t).toLocaleString()
    },
    { title: '日志数', dataIndex: 'logCount', key: 'logCount', width: 80 },
    { 
      title: '日志级别', 
      key: 'levels',
      width: 150,
      render: (_, r) => (
        <Space>
          {[...r.levels].map(l => <Tag key={l} color={l === 'error' ? 'red' : l === 'warn' ? 'orange' : 'blue'}>{l}</Tag>)}
        </Space>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, r) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewLogs(r)}>
          查看日志
        </Button>
      )
    }
  ];

  const logColumns = [
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 180, render: t => new Date(t).toLocaleString() },
    { title: '级别', dataIndex: 'level', key: 'level', width: 80, render: l => <Tag color={l === 'error' ? 'red' : l === 'warn' ? 'orange' : 'blue'}>{l?.toUpperCase()}</Tag> },
    { title: '来源', dataIndex: 'source', key: 'source', width: 100 },
    { title: '内容', dataIndex: 'message', key: 'message', ellipsis: true }
  ];

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>客户端管理</Title>
        <Space>
          <Input.Search placeholder="搜索设备ID" style={{ width: 200 }} onSearch={setFilter} allowClear />
          <Button onClick={fetchClients} icon={<ReloadOutlined />} loading={loading}>刷新</Button>
        </Space>
      </div>

      <Card>
        {filteredClients.length > 0 ? (
          <Table dataSource={filteredClients} columns={columns} loading={loading} pagination={{ pageSize: 10 }} />
        ) : (
          <Empty description="暂无客户端数据" />
        )}
      </Card>

      <Modal
        title={<Space><UserOutlined /> 客户端日志 - {selectedClient?.deviceId?.slice(0, 16)}...</Space>}
        open={!!selectedClient}
        onCancel={() => { setSelectedClient(null); setClientLogs([]); }}
        footer={null}
        width={900}
      >
        {selectedClient && (
          <Descriptions size="small" bordered column={4} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="设备ID">{selectedClient.deviceId}</Descriptions.Item>
            <Descriptions.Item label="日志数">{selectedClient.logCount}</Descriptions.Item>
            <Descriptions.Item label="状态">{getStatusBadge(selectedClient.lastSeen)}</Descriptions.Item>
            <Descriptions.Item label="首见时间">{new Date(selectedClient.firstSeen).toLocaleString()}</Descriptions.Item>
          </Descriptions>
        )}
        <Table 
          dataSource={clientLogs} 
          columns={logColumns} 
          rowKey={(r, i) => `${r.timestamp}-${i}`}
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ y: 400 }}
        />
      </Modal>
    </div>
  );
}

export default Clients;
