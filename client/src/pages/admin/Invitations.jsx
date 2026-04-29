import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Button, Space, Tag, Modal, Form, Input, InputNumber, Switch, Row, Col, Divider, message, Popconfirm, Progress } from 'antd';
import { PlusOutlined, DeleteOutlined, StopOutlined, PlayCircleOutlined, LinkOutlined, ApiOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function Invitations() {
  const [invitations, setInvitations] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [proxyModalVisible, setProxyModalVisible] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const [proxyForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/invitations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setInvitations(data.data.map(inv => ({
          id: inv.id,
          code: inv.code,
          maxDevices: inv.max_devices,
          usedDevices: inv.used_devices,
          status: inv.status,
          createdAt: inv.created_at ? inv.created_at.split('T')[0] : '',
          user: inv.user_email || null,
          role: inv.role,
          tokenProxy: inv.token_proxy
        })));
      }
    } catch (err) {
      message.error('获取邀请码失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status) => (
    <Tag color={status === 'active' ? 'green' : 'red'}>
      {status === 'active' ? '启用' : '禁用'}
    </Tag>
  );

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 11; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreate = async (values) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          maxDevices: values.maxDevices,
          tokenLimit: values.tokenLimit || 100000,
          role: values.role || 'user'
        })
      });
      const data = await res.json();
      if (data.success) {
        message.success('邀请码创建成功');
        setModalVisible(false);
        fetchInvitations();
      } else {
        message.error(data.error || '创建失败');
      }
    } catch (err) {
      message.error('创建失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/invitations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        message.success('删除成功');
        setInvitations(invitations.filter(i => i.id !== id));
      } else {
        message.error(data.error || '删除失败');
      }
    } catch (err) {
      message.error('删除失败');
    }
  };

  const handleToggleStatus = async (inv) => {
    const newStatus = inv.status === 'active' ? 'disabled' : 'active';
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/invitations/${inv.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        message.success(`已${newStatus === 'active' ? '启用' : '禁用'}`);
        setInvitations(invitations.map(i => i.id === inv.id ? { ...i, status: newStatus } : i));
      }
    } catch (err) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '邀请码', dataIndex: 'code', width: 140, render: code => <Text copyable={{ text: code }}>{code}</Text> },
    { title: '用户', dataIndex: 'user', width: 180, render: u => u || <Text type="secondary">未使用</Text> },
    { title: '设备使用', width: 120, render: (_, r) => `${r.usedDevices} / ${r.maxDevices}` },
    { title: '状态', dataIndex: 'status', width: 80, render: getStatusTag },
    { title: 'Token代理', width: 160, render: (_, r) => {
      if (!r.tokenProxy?.enabled) return <Tag type="secondary">未启用</Tag>;
      const used = r.tokenProxy?.quota?.used || 0;
      const total = r.tokenProxy?.quota?.total || 100000;
      const percent = Math.min(100, Math.round((used / total) * 100));

      const status = percent >= 90 ? 'exception' : percent >= 70 ? 'active' : 'success';
      return <Progress size="small" percent={percent} status={status} format={() => `${used}/${total}`} />;
    }},
    { title: '创建时间', dataIndex: 'createdAt', width: 120 },
    {
      title: '操作',
      width: 240,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<ApiOutlined />} onClick={() => {
            setSelectedInvitation(r);
            proxyForm.setFieldsValue({
              enabled: r.tokenProxy?.enabled || false,
              openaiKey: r.tokenProxy?.providers?.openai?.apiKey || '',
              openaiBase: r.tokenProxy?.providers?.openai?.apiBase || '',
              anthropicKey: r.tokenProxy?.providers?.anthropic?.apiKey || '',
              anthropicBase: r.tokenProxy?.providers?.anthropic?.apiBase || '',
              googleKey: r.tokenProxy?.providers?.google?.apiKey || '',
              googleBase: r.tokenProxy?.providers?.google?.apiBase || '',
              volcengineKey: r.tokenProxy?.providers?.volcengine?.apiKey || '',
              volcengineBase: r.tokenProxy?.providers?.volcengine?.apiBase || ''
            });
            setProxyModalVisible(true);
          }}>
            Token代理
          </Button>
          <Button size="small" icon={r.status === 'active' ? <StopOutlined /> : <PlayCircleOutlined />} onClick={() => handleToggleStatus(r)}>
            {r.status === 'active' ? '禁用' : '启用'}
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card
        title="邀请码管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>生成邀请码</Button>
        }
      >
        <Table dataSource={invitations} columns={columns} rowKey="id" pagination={{ pageSize: 10 }} loading={loading} />
      </Card>

      <Modal
        title="生成邀请码"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form layout="vertical" onFinish={handleCreate}>
          <Form.Item label="最大设备数" name="maxDevices" initialValue={3} rules={[{ required: true }]}>
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Token限制" name="tokenLimit" initialValue={100000} rules={[{ required: true }]}>
            <InputNumber min={1000} step={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="角色" name="role" initialValue="user">
            <Input placeholder="user 或 admin" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">生成</Button>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Token代理配置"
        open={proxyModalVisible}
        onCancel={() => setProxyModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={proxyForm}
          layout="vertical"
          onFinish={async (values) => {
            const providers = {};
            if (values.openaiKey) {
              providers.openai = { apiKey: values.openaiKey, apiBase: values.openaiBase || 'https://api.openai.com/v1' };
            }
            if (values.anthropicKey) {
              providers.anthropic = { apiKey: values.anthropicKey, apiBase: values.anthropicBase || 'https://api.anthropic.com/v1' };
            }
            if (values.googleKey) {
              providers.google = { apiKey: values.googleKey, apiBase: values.googleBase || 'https://generativelanguage.googleapis.com/v1beta' };
            }
            if (values.volcengineKey) {
              providers.volcengine = { apiKey: values.volcengineKey, apiBase: values.volcengineBase || 'https://ark.cn-beijing.volces.com/api/v3' };
            }
            try {
              const token = localStorage.getItem('token');
              const res = await fetch(`${API_BASE}/api/invitations/${selectedInvitation.id}/token-proxy`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                  enabled: values.enabled,
                  providers,
                  quota: selectedInvitation.tokenProxy?.quota || { used: 0, total: values.tokenLimit || 100000 }
                })
              });
              const data = await res.json();
              if (data.success) {
                message.success('配置保存成功');
                setProxyModalVisible(false);
                fetchInvitations();
              } else {
                message.error(data.error || '保存失败');
              }
            } catch (err) {
              message.error('保存失败');
            }
          }}
        >
          <Form.Item name="enabled" valuePropName="checked" label="启用Token代理">
            <Switch />
          </Form.Item>
          <Divider>OpenAI</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="openaiKey" label="API Key">
                <Input.Password />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="openaiBase" label="API Base URL" initialValue="https://api.openai.com/v1">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Divider>Anthropic</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="anthropicKey" label="API Key">
                <Input.Password />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="anthropicBase" label="API Base URL" initialValue="https://api.anthropic.com/v1">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Divider>Google</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="googleKey" label="API Key">
                <Input.Password />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="googleBase" label="API Base URL" initialValue="https://generativelanguage.googleapis.com/v1beta">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Divider>Volcengine</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="volcengineKey" label="API Key">
                <Input.Password />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="volcengineBase" label="API Base URL" initialValue="https://ark.cn-beijing.volces.com/api/v3">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Button type="primary" htmlType="submit">保存</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Invitations;
