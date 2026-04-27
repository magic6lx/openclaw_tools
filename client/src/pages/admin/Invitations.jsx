import React, { useState } from 'react';
import { Card, Table, Typography, Button, Space, Tag, Modal, Form, Input, InputNumber, Switch, Row, Col, Divider, message, Popconfirm, Progress } from 'antd';
import { PlusOutlined, DeleteOutlined, StopOutlined, PlayCircleOutlined, LinkOutlined, ApiOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const INVITATIONS = [
  { id: 1, code: 'ABC12345678', maxDevices: 3, usedDevices: 1, status: 'active', createdAt: '2026-04-01', user: 'user1@example.com' },
  { id: 2, code: 'DEF98765432', maxDevices: 5, usedDevices: 3, status: 'active', createdAt: '2026-04-05', user: 'user2@example.com' },
  { id: 3, code: 'GHI45678901', maxDevices: 3, usedDevices: 3, status: 'disabled', createdAt: '2026-04-10', user: 'user3@example.com' },
  { id: 4, code: 'JKL01234567', maxDevices: 1, usedDevices: 0, status: 'active', createdAt: '2026-04-15', user: null },
];

function Invitations() {
  const [invitations, setInvitations] = useState(INVITATIONS);
  const [modalVisible, setModalVisible] = useState(false);
  const [proxyModalVisible, setProxyModalVisible] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const [proxyForm] = Form.useForm();

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

  const handleCreate = (values) => {
    const newInvitation = {
      id: invitations.length + 1,
      code: generateCode(),
      maxDevices: values.maxDevices,
      usedDevices: 0,
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
      user: null
    };
    setInvitations([newInvitation, ...invitations]);
    setModalVisible(false);
    message.success('邀请码创建成功');
  };

  const handleToggleStatus = (inv) => {
    const newStatus = inv.status === 'active' ? 'disabled' : 'active';
    setInvitations(invitations.map(i => i.id === inv.id ? { ...i, status: newStatus } : i));
    message.success(`已${newStatus === 'active' ? '启用' : '禁用'}`);
  };

  const handleDelete = (id) => {
    setInvitations(invitations.filter(i => i.id !== id));
    message.success('删除成功');
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
      return <Progress size="small" percent={percent} size="small" status={status} format={() => `${used}/${total}`} />;
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
              openaiBase: r.tokenProxy?.providers?.openai?.apiBase || 'https://api.openai.com/v1',
              anthropicKey: r.tokenProxy?.providers?.anthropic?.apiKey || '',
              anthropicBase: r.tokenProxy?.providers?.anthropic?.apiBase || 'https://api.anthropic.com/v1',
              googleKey: r.tokenProxy?.providers?.google?.apiKey || '',
              googleBase: r.tokenProxy?.providers?.google?.apiBase || 'https://generativelanguage.googleapis.com/v1beta',
              volcengineKey: r.tokenProxy?.providers?.volcengine?.apiKey || '',
              volcengineBase: r.tokenProxy?.providers?.volcengine?.apiBase || 'https://ark.cn-beijing.volces.com/api/v3',
              quota: r.tokenProxy?.quota?.total || 100000
            });
            setProxyModalVisible(true);
          }}>代理</Button>
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
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={2}>邀请码管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>生成邀请码</Button>
      </div>

      <Card>
        <Table dataSource={invitations} columns={columns} rowKey="id" pagination={{ pageSize: 10 }} />
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
            const tokenProxy = {
              enabled: values.enabled,
              providers,
              quota: { total: values.quota || 100000, used: selectedInvitation?.tokenProxy?.quota?.used || 0 }
            };
            setInvitations(invitations.map(i => i.id === selectedInvitation.id ? { ...i, tokenProxy } : i));
            setProxyModalVisible(false);
            message.success('Token代理配置已保存');
          }}
        >
          <Form.Item label="启用代理" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Divider>OpenAI</Divider>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item label="API Key" name="openaiKey">
                <Input.Password placeholder="sk-..." />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="API Base" name="openaiBase" initialValue="https://api.openai.com/v1">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Anthropic</Divider>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item label="API Key" name="anthropicKey">
                <Input.Password placeholder="sk-ant-..." />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="API Base" name="anthropicBase" initialValue="https://api.anthropic.com/v1">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Google</Divider>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item label="API Key" name="googleKey">
                <Input.Password placeholder="AI..." />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="API Base" name="googleBase" initialValue="https://generativelanguage.googleapis.com/v1beta">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider>火山引擎（Volcengine）</Divider>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item label="API Key" name="volcengineKey">
                <Input.Password placeholder="dd095ff1-..." />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="API Base" name="volcengineBase" initialValue="https://ark.cn-beijing.volces.com/api/v3">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Divider>配额管理</Divider>
          <Form.Item label="总配额（Token数）" name="quota" initialValue={100000}>
            <InputNumber min={1000} step={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Text type="secondary">已使用: {selectedInvitation?.tokenProxy?.quota?.used || 0}</Text>

          <Form.Item style={{ marginTop: 16 }}>
            <Space>
              <Button type="primary" htmlType="submit">保存</Button>
              <Button onClick={() => setProxyModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Invitations;
