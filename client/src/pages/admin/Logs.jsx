import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Button, Space, Tag, Input, Select, DatePicker, Modal, message } from 'antd';
import { ReloadOutlined, SearchOutlined, DeleteOutlined, ExportOutlined, FilterOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ level: '', source: '', deviceId: '' });
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/logs?limit=500`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('获取日志失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const getLevelTag = (level) => {
    const map = { info: 'blue', warn: 'orange', error: 'red', debug: 'cyan' };
    return <Tag color={map[level] || 'default'}>{level?.toUpperCase() || 'INFO'}</Tag>;
  };

  const filteredLogs = logs.filter(log => {
    if (filters.level && log.level !== filters.level) return false;
    if (filters.source && log.source !== filters.source) return false;
    if (filters.deviceId && !log.deviceId?.includes(filters.deviceId)) return false;
    return true;
  });

  const columns = [
    { title: '时间', dataIndex: 'timestamp', width: 180, render: t => new Date(t).toLocaleString() },
    { title: '设备ID', dataIndex: 'deviceId', width: 150, ellipsis: true },
    { title: '级别', dataIndex: 'level', width: 80, render: getLevelTag },
    { title: '来源', dataIndex: 'source', width: 100 },
    { title: '内容', dataIndex: 'message', ellipsis: true }
  ];

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={2}>日志统一管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchLogs}>刷新</Button>
          <Button icon={<ExportOutlined />}>导出</Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search placeholder="搜索设备ID" style={{ width: 200 }} onSearch={v => setFilters({...filters, deviceId: v})} allowClear />
          <Select placeholder="日志级别" style={{ width: 120 }} allowClear onChange={v => setFilters({...filters, level: v})}>
            <Select.Option value="info">INFO</Select.Option>
            <Select.Option value="warn">WARN</Select.Option>
            <Select.Option value="error">ERROR</Select.Option>
            <Select.Option value="debug">DEBUG</Select.Option>
          </Select>
          <Select placeholder="日志来源" style={{ width: 120 }} allowClear onChange={v => setFilters({...filters, source: v})}>
            <Select.Option value="launcher">Launcher</Select.Option>
            <Select.Option value="gateway">Gateway</Select.Option>
            <Select.Option value="client">Client</Select.Option>
          </Select>
          <Button icon={<FilterOutlined />} onClick={() => setFilters({ level: '', source: '', deviceId: '' })}>
            清除筛选
          </Button>
        </Space>
      </Card>

      <Card>
        <Table 
          dataSource={filteredLogs} 
          columns={columns} 
          rowKey={(r, i) => `${r.timestamp}-${i}`}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          size="small"
        />
      </Card>
    </div>
  );
}

export default AdminLogs;
