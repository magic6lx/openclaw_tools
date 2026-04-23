import React, { useState } from 'react';
import { Card, Table, Typography, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, StopOutlined, PlayCircleOutlined, LinkOutlined } from '@ant-design/icons';

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
    { title: '创建时间', dataIndex: 'createdAt', width: 120 },
    {
      title: '操作',
      width: 220,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={r.status === 'active' ? <StopOutlined /> : <PlayCircleOutlined />} onClick={() => handleToggleStatus(r)}>
            {r.status === 'active' ? '禁用' : '启用'}
          </Button>
          <Popconfirm title="确认解绑所有设备？" onConfirm={() => message.success('已解绑')}>
            <Button size="small" icon={<LinkOutlined />}>解绑</Button>
          </Popconfirm>
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
    </div>
  );
}

export default Invitations;
