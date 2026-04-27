import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Button, Space, Tag, Modal, Form, Input, Select, message, Popconfirm, Divider, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined, ReloadOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import QuickSettings from '../../components/QuickSettings';
import { useConfig, mergeWithDefaults } from '../../hooks/useConfig';

const { Title, Text } = Typography;
const { TextArea } = Input;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const LAUNCHER_API = 'http://127.0.0.1:3003';

function Templates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [currentEnv, setCurrentEnv] = useState(null);
  const [pasteModalVisible, setPasteModalVisible] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [serverConfigLoading, setServerConfigLoading] = useState(false);
  const [launcherConfigLoading, setLauncherConfigLoading] = useState(false);
  const [editConfig, setEditConfig] = useState({});

  const { config: launcherConfig, loading: launcherLoading, fetchConfig: refetchLauncherConfig } = useConfig();

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data || []);
      }
    } catch (err) {
      console.error('获取模板失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const getStatusTag = (status) => {
    const map = { approved: 'success', pending: 'warning', rejected: 'error' };
    const text = { approved: '已发布', pending: '待审核', rejected: '已拒绝' };
    return <Tag color={map[status] || 'default'}>{text[status] || status}</Tag>;
  };

  const handleAdd = () => {
    setEditing(null);
    if (launcherConfig) {
      setEditConfig({ ...launcherConfig });
    } else {
      setEditConfig(mergeWithDefaults({}));
    }
    form.resetFields();
    setModalVisible(true);
  };

  useEffect(() => {
    if (!launcherConfig && !launcherLoading) {
      refetchLauncherConfig();
    }
  }, []);

  useEffect(() => {
    if (launcherConfig && Object.keys(editConfig).length === 0) {
      setEditConfig({ ...launcherConfig });
    }
  }, [launcherConfig]);

  const handleEdit = (t) => {
    setEditing(t);
    try {
      const config = t.config || (typeof t.config_content === 'string' ? JSON.parse(t.config_content) : (t.config_content || {}));
      setEditConfig(mergeWithDefaults(config));
      setCurrentEnv(t.env || null);
      form.setFieldsValue({
        name: t.name,
        category: t.category,
        description: t.description
      });
    } catch (e) {
      setEditConfig(mergeWithDefaults({}));
      setCurrentEnv(null);
    }
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        message.success('删除成功');
        fetchTemplates();
      } else {
        message.error(data.error || '删除失败');
      }
    } catch (err) {
      message.error(`删除失败: ${err.message}`);
    }
  };

  const handleApprove = async (t) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/templates/${t.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        message.success('审核通过');
        fetchTemplates();
      } else {
        message.error(data.error || '审核失败');
      }
    } catch (err) {
      message.error(`审核失败: ${err.message}`);
    }
  };

  const handleDistribute = async (t) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/templates/${t.id}/distribute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        message.success('发放成功');
        fetchTemplates();
      } else {
        message.error(data.error || '发放失败');
      }
    } catch (err) {
      message.error(`发放失败: ${err.message}`);
    }
  };

  const handleImport = async (file) => {
    try {
      const text = await file.text();
      const rawConfig = JSON.parse(text);
      const config = mergeWithDefaults(rawConfig);
      setEditConfig(config);
      message.success('配置文件已加载');
    } catch (err) {
      message.error(`解析配置文件失败: ${err.message}`);
    }
    return false;
  };

  const handlePasteConfig = () => {
    try {
      const rawConfig = JSON.parse(pasteContent);
      const config = mergeWithDefaults(rawConfig);
      setEditConfig(config);
      setPasteModalVisible(false);
      setPasteContent('');
      message.success('配置已解析并加载');
    } catch (err) {
      message.error(`解析配置失败: ${err.message}`);
    }
  };

  const handleLoadServerConfig = async () => {
    setServerConfigLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/config/server`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        const config = mergeWithDefaults(data.data);
        setEditConfig(config);
        setCurrentEnv(null);
        message.success('服务器配置已加载');
      } else {
        message.warning(data.message || '服务器配置文件不存在');
      }
    } catch (err) {
      message.error(`加载服务器配置失败: ${err.message}`);
    } finally {
      setServerConfigLoading(false);
    }
  };

  const handleLoadLauncherConfig = async () => {
    setLauncherConfigLoading(true);
    try {
      const res = await fetch(`${LAUNCHER_API}/config/export`);
      const data = await res.json();
      if (data.success && data.config) {
        const config = mergeWithDefaults(data.config);
        setEditConfig(config);
        setCurrentEnv(data.env || null);
        message.success('本地配置已加载（包含config和env）');
      } else {
        message.warning(data.message || '本地配置文件不存在');
      }
    } catch (err) {
      message.error(`加载本地配置失败: ${err.message}`);
    } finally {
      setLauncherConfigLoading(false);
    }
  };

  const handleConfigChange = (section, newSectionConfig) => {
    setEditConfig(prev => ({
      ...prev,
      [section]: newSectionConfig
    }));
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const token = localStorage.getItem('token');

      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `${API_BASE}/api/templates/${editing.id}` : `${API_BASE}/api/templates`;

      const cleanObj = (obj) => {
        if (obj === undefined) return null;
        if (obj === null) return null;
        if (Array.isArray(obj)) {
          return obj.map(item => cleanObj(item)).filter(item => item !== undefined);
        }
        if (typeof obj === 'object') {
          const result = {};
          for (const [key, val] of Object.entries(obj)) {
            if (val !== undefined) {
              result[key] = cleanObj(val);
            } else {
              result[key] = null;
            }
          }
          return result;
        }
        if (typeof obj === 'number' && isNaN(obj)) return null;
        if (obj === Infinity) return null;
        if (typeof obj === 'function' || typeof obj === 'symbol') return null;
        return obj;
      };

      const payload = {
        name: values.name,
        description: values.description || '',
        config: JSON.stringify(cleanObj(editConfig)),
        env: currentEnv ? JSON.stringify(cleanObj(currentEnv)) : null
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        message.success(editing ? '更新成功' : '创建成功');
        setModalVisible(false);
        fetchTemplates();
      } else {
        message.error(data.error || '操作失败');
      }
    } catch (err) {
      console.error('保存失败:', err);
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(editConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('配置已导出');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(editConfig, null, 2));
    message.success('配置已复制到剪贴板');
  };

  const columns = [
    { 
      title: 'ID', 
      dataIndex: 'id', 
      width: 60 
    },
    { 
      title: '名称', 
      dataIndex: 'name',
      ellipsis: true
    },
    { 
      title: '描述', 
      dataIndex: 'description', 
      ellipsis: true,
      render: (v) => v || '-'
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      width: 100, 
      render: getStatusTag 
    },
    { 
      title: '使用次数', 
      dataIndex: 'used_count', 
      width: 100, 
      render: (v) => v || 0 
    },
    { 
      title: '创建时间', 
      dataIndex: 'created_at', 
      width: 120, 
      render: (v) => v ? new Date(v).toLocaleDateString() : '-' 
    },
    {
      title: '操作',
      width: 280,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          {r.status === 'pending' && (
            <Button size="small" type="primary" onClick={() => handleApprove(r)}>审核</Button>
          )}
          {r.status === 'approved' && (
            <Button size="small" icon={<SendOutlined />} onClick={() => handleDistribute(r)}>发放</Button>
          )}
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={2}>模板配置及发放</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchTemplates}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建模板</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic 
              title="总模板数" 
              value={templates.length}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic 
              title="已发布" 
              value={templates.filter(t => t.status === 'approved').length}
              valueStyle={{ color: '#52c41a' }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic 
              title="待审核" 
              value={templates.filter(t => t.status === 'pending').length}
              valueStyle={{ color: '#faad14' }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic 
              title="总使用次数" 
              value={templates.reduce((sum, t) => sum + (t.used_count || 0), 0)}
              suffix="次"
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={templates}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          loading={loading}
        />
      </Card>

      <Modal
        title={editing ? '编辑模板' : '新建模板'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>取消</Button>,
          <Button key="save" type="primary" onClick={handleSave}>保存</Button>
        ]}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="模板名称" name="name" rules={[{ required: true, message: '请输入模板名称' }]}>
                <Input placeholder="请输入模板名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="描述" name="description">
                <Input placeholder="模板描述（可选）" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Divider />

        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>配置内容</Text>
          <Button
            icon={<CloudDownloadOutlined />}
            onClick={handleLoadLauncherConfig}
            loading={launcherConfigLoading}
          >
            读取本地配置
          </Button>
        </div>

        <QuickSettings
          config={editConfig}
          onConfigChange={handleConfigChange}
        />
      </Modal>

      <Modal
        title="粘贴配置"
        open={pasteModalVisible}
        onCancel={() => {
          setPasteModalVisible(false);
          setPasteContent('');
        }}
        onOk={handlePasteConfig}
        width={600}
      >
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">
            粘贴 OpenClaw 配置内容（JSON 格式），系统会自动补全缺失的默认字段
          </Text>
        </div>
        <TextArea
          value={pasteContent}
          onChange={(e) => setPasteContent(e.target.value)}
          placeholder={`示例：
{
  "launcher": {
    "autoStart": false,
    "checkUpdate": true,
    "logLevel": "info"
  },
  "gateway": {
    "enabled": true,
    "port": 19000
  }
}`}
          rows={15}
          style={{ fontFamily: 'monospace' }}
        />
      </Modal>
    </div>
  );
}

function Statistic({ title, value, suffix, valueStyle }) {
  return (
    <div>
      <Text type="secondary" style={{ fontSize: 12 }}>{title}</Text>
      <div style={{ fontSize: 24, fontWeight: 500, ...valueStyle }}>
        {value}{suffix && <span style={{ fontSize: 14, marginLeft: 4 }}>{suffix}</span>}
      </div>
    </div>
  );
}

export default Templates;
