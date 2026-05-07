import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Button, Space, Tag, Modal, Form, Input, Select, message, Switch, Divider, Tabs, Badge, Popconfirm, Spin, Descriptions } from 'antd';
import { ReloadOutlined, EditOutlined, SaveOutlined, CheckOutlined, CloseOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const CATEGORY_LABELS = {
  manifest: { label: 'Manifest 层', color: 'blue', desc: '文件同步清单、排除模式、目录规则' },
  migration: { label: 'Migration 层', color: 'green', desc: '路径适配、代理规则、模型映射' },
  system: { label: 'System 层', color: 'orange', desc: 'CLI 命令白名单等系统规则' }
};

function SystemConfig() {
  const { user } = useAuth();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('manifest');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [editForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailRule, setDetailRule] = useState(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchRules();
  }, []);

  async function fetchRules() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/system-config`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const json = await res.json();
      if (json.success) {
        setRules(json.data);
      } else {
        message.error('获取规则失败: ' + json.error);
      }
    } catch (err) {
      message.error('获取规则失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(record) {
    try {
      const res = await fetch(`${API_BASE}/api/system-config/${record.category}/${record.name}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !record.is_active })
      });
      const json = await res.json();
      if (json.success) {
        message.success(`${record.name} 已${!record.is_active ? '启用' : '停用'}`);
        fetchRules();
      } else {
        message.error('更新失败: ' + json.error);
      }
    } catch (err) {
      message.error('更新失败: ' + err.message);
    }
  }

  function openEditModal(record) {
    setEditingRule(record);
    editForm.setFieldsValue({
      name: record.name,
      category: record.category,
      description: record.description,
      value: JSON.stringify(record.value, null, 2),
      version: record.version
    });
    setEditModalVisible(true);
  }

  function openDetailModal(record) {
    setDetailRule(record);
    setDetailModalVisible(true);
  }

  async function handleSaveEdit() {
    try {
      const values = await editForm.validateFields();
      let parsedValue;
      try {
        parsedValue = JSON.parse(values.value);
      } catch {
        message.error('JSON 格式不正确');
        return;
      }
      setSaving(true);
      const res = await fetch(`${API_BASE}/api/system-config/${editingRule.category}/${editingRule.name}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: parsedValue,
          description: values.description,
          version: values.version
        })
      });
      const json = await res.json();
      if (json.success) {
        message.success('规则已保存');
        setEditModalVisible(false);
        fetchRules();
      } else {
        message.error('保存失败: ' + json.error);
      }
    } catch (err) {
      message.error('保存失败: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  const filteredRules = rules.filter(r => r.category === activeTab);

  const columns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space direction="vertical" size={0}>
          <Text strong code>{name}</Text>
          {record.description && <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (active, record) => (
        <Switch
          checked={active}
          onChange={() => handleToggleActive(record)}
          checkedChildren={<CheckOutlined />}
          unCheckedChildren={<CloseOutlined />}
          disabled={!isAdmin}
        />
      )
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: v => v || '-'
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: v => v ? new Date(v).toLocaleString('zh-CN') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<InfoCircleOutlined />} onClick={() => openDetailModal(record)}>
            查看
          </Button>
          {isAdmin && (
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
              编辑
            </Button>
          )}
        </Space>
      )
    }
  ];

  const tabItems = Object.entries(CATEGORY_LABELS).map(([key, meta]) => {
    const count = rules.filter(r => r.category === key).length;
    const activeCount = rules.filter(r => r.category === key && r.is_active).length;
    return {
      key,
      label: (
        <span>
          <Badge status={activeCount > 0 ? 'success' : 'default'} />
          {meta.label}
          <Tag style={{ marginLeft: 8 }}>{activeCount}/{count}</Tag>
        </span>
      )
    };
  });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>系统规则配置</Title>
          <Text type="secondary">
            管理 manifest / migration / system 三层规则。Launcher 启动时从服务端拉取并缓存。
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchRules} loading={loading}>
          刷新
        </Button>
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          tabBarExtraContent={
            <Text type="secondary" style={{ fontSize: 12 }}>
              {CATEGORY_LABELS[activeTab]?.desc}
            </Text>
          }
        />

        <Table
          columns={columns}
          dataSource={filteredRules}
          rowKey={r => `${r.category}-${r.name}`}
          loading={loading}
          pagination={{ pageSize: 20 }}
          size="small"
        />
      </Card>

      <Modal
        title={`查看规则: ${detailRule?.name}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>
        ]}
        width={700}
      >
        {detailRule && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="分类">{detailRule.category}</Descriptions.Item>
            <Descriptions.Item label="名称"><Text code>{detailRule.name}</Text></Descriptions.Item>
            <Descriptions.Item label="状态">{detailRule.is_active ? '已启用' : '已停用'}</Descriptions.Item>
            <Descriptions.Item label="版本">{detailRule.version}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>{detailRule.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="内容" span={2}>
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, maxHeight: 400, overflow: 'auto', fontSize: 12 }}>
                {JSON.stringify(detailRule.value, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title={`编辑规则: ${editingRule?.name}`}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setEditModalVisible(false)}>取消</Button>,
          <Button key="save" type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveEdit}>
            保存
          </Button>
        ]}
        width={700}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item label="规则名称">
            <Input disabled />
          </Form.Item>
          <Form.Item label="分类">
            <Input disabled />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input />
          </Form.Item>
          <Form.Item name="version" label="版本号">
            <Input />
          </Form.Item>
          <Form.Item
            name="value"
            label="规则内容 (JSON)"
            rules={[{ required: true, message: '请输入规则内容' }]}
          >
            <TextArea rows={15} style={{ fontFamily: 'monospace', fontSize: 12 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default SystemConfig;