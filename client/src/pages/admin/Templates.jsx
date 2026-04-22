import React, { useState } from 'react';
import { Card, Table, Typography, Button, Space, Tag, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined, CopyOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const TEMPLATES = [
  { id: 1, name: '基础配置', category: '基础', status: 'approved', usedCount: 156, createdAt: '2026-04-01' },
  { id: 2, name: '标准配置', category: '标准', status: 'approved', usedCount: 89, createdAt: '2026-04-05' },
  { id: 3, name: '高级配置', category: '高级', status: 'approved', usedCount: 45, createdAt: '2026-04-10' },
  { id: 4, name: '开发测试', category: '测试', status: 'pending', usedCount: 0, createdAt: '2026-04-15' },
];

function Templates() {
  const [templates, setTemplates] = useState(TEMPLATES);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);

  const getStatusTag = (status) => {
    const map = { approved: 'success', pending: 'warning', rejected: 'error' };
    const text = { approved: '已发布', pending: '待审核', rejected: '已拒绝' };
    return <Tag color={map[status]}>{text[status]}</Tag>;
  };

  const handleAdd = () => { setEditing(null); setModalVisible(true); };
  const handleEdit = (t) => { setEditing(t); setModalVisible(true); };
  
  const handleDelete = (id) => {
    setTemplates(templates.filter(t => t.id !== id));
    message.success('删除成功');
  };

  const handleDistribute = (t) => {
    Modal.confirm({
      title: '确认发放',
      content: `确定向所有用户发放「${t.name}」配置模板吗？`,
      onOk: () => message.success('已开始发放')
    });
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name' },
    { title: '分类', dataIndex: 'category', width: 100 },
    { title: '状态', dataIndex: 'status', width: 100, render: getStatusTag },
    { title: '使用次数', dataIndex: 'usedCount', width: 100 },
    { title: '创建时间', dataIndex: 'createdAt', width: 120 },
    {
      title: '操作',
      width: 200,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          <Button size="small" icon={<SendOutlined />} onClick={() => handleDistribute(r)}>发放</Button>
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
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建模板</Button>
      </div>

      <Card>
        <Table dataSource={templates} columns={columns} rowKey="id" pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editing ? '编辑模板' : '新建模板'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form layout="vertical" initialValues={editing || { status: 'draft' }}>
          <Form.Item label="模板名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="请输入模板名称" />
          </Form.Item>
          <Form.Item label="分类" name="category" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="基础">基础</Select.Option>
              <Select.Option value="标准">标准</Select.Option>
              <Select.Option value="高级">高级</Select.Option>
              <Select.Option value="测试">测试</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="配置内容" name="config">
            <Input.TextArea rows={6} placeholder="JSON配置内容" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={() => { message.success('保存成功'); setModalVisible(false); }}>保存</Button>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Templates;
