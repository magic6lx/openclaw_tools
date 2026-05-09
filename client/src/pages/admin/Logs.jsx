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
        setLogs(data.data || []);
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
    if (filters.deviceId && !log.device_id?.includes(filters.deviceId)) return false;
    if (filters.configValidation && !log.message?.includes('配置验证') && !log.message?.includes('配置修复')) return false;
    return true;
  });

  const columns = [
    { title: '时间', dataIndex: 'server_timestamp', width: 180, render: t => t ? new Date(t).toLocaleString() : '-' },
    { title: '设备ID', dataIndex: 'device_id', width: 150, ellipsis: true },
    { title: '邀请码', dataIndex: 'invitation_code', width: 120, render: code => code ? <Text copyable={{ text: code }}>{code}</Text> : <Text type="secondary">无</Text> },
    { title: '级别', dataIndex: 'level', width: 80, render: getLevelTag },
    { title: '来源', dataIndex: 'source', width: 100 },
    { 
      title: '内容', 
      dataIndex: 'message', 
      ellipsis: true,
      render: (text) => {
        if (text?.includes('配置修复建议')) {
          return <Text type="warning">{text.substring(0, 100)}...</Text>;
        }
        return text;
      }
    }
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
          <Button 
            type={filters.configValidation ? 'primary' : 'default'}
            icon={<FilterOutlined />}
            onClick={() => setFilters({...filters, configValidation: !filters.configValidation})}
          >
            配置验证日志
          </Button>
          <Button icon={<FilterOutlined />} onClick={() => setFilters({ level: '', source: '', deviceId: '', configValidation: false })}>
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
          onRow={(record) => ({
            onClick: () => setSelectedLog(record),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      <Modal
        title="日志详情"
        open={!!selectedLog}
        onCancel={() => setSelectedLog(null)}
        footer={null}
        width={800}
      >
        {selectedLog && (
          <div>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong>时间：</Text>
                <Text>{selectedLog.server_timestamp ? new Date(selectedLog.server_timestamp).toLocaleString() : '-'}</Text>
              </div>
              <div>
                <Text strong>设备ID：</Text>
                <Text copyable>{selectedLog.device_id || '-'}</Text>
              </div>
              <div>
                <Text strong>邀请码：</Text>
                <Text copyable>{selectedLog.invitation_code || '无'}</Text>
              </div>
              <div>
                <Text strong>级别：</Text>
                {getLevelTag(selectedLog.level)}
              </div>
              <div>
                <Text strong>来源：</Text>
                <Text>{selectedLog.source || '-'}</Text>
              </div>
              <div>
                <Text strong>内容：</Text>
                <pre style={{ 
                  background: '#f5f5f5', 
                  padding: 12, 
                  borderRadius: 4, 
                  maxHeight: 400, 
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {selectedLog.message}
                </pre>
              </div>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AdminLogs;
