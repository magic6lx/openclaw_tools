import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Button, Space, Tag, Modal, Form, Input, Select, message, Popconfirm, Upload } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Paragraph } = Typography;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function Templates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

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
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (t) => {
    setEditing(t);
    form.setFieldsValue(t);
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

  const handleDistribute = (t) => {
    Modal.confirm({
      title: '确认发放',
      content: `确定向所有用户发放「${t.name}」配置模板吗？`,
      onOk: () => message.success('已开始发放')
    });
  };

  const handleImport = async (file) => {
    try {
      const text = await file.text();
      const config = JSON.parse(text);
      form.setFieldsValue({
        name: config.name || '未命名配置',
        category: config.category || '导入',
        description: config.description || '',
        configContent: JSON.stringify(config, null, 2)
      });
      message.success('配置文件已加载');
    } catch (err) {
      message.error(`解析配置文件失败: ${err.message}`);
    }
    return false;
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const token = localStorage.getItem('token');

      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `${API_BASE}/api/templates/${editing.id}` : `${API_BASE}/api/templates`;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(values)
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

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name' },
    { title: '分类', dataIndex: 'category', width: 100 },
    { title: '状态', dataIndex: 'status', width: 100, render: getStatusTag },
    { title: '使用次数', dataIndex: 'usedCount', width: 100, render: (v) => v || 0 },
    { title: '创建时间', dataIndex: 'createdAt', width: 120, render: (v) => v ? new Date(v).toLocaleDateString() : '-' },
    {
      title: '操作',
      width: 250,
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
        width={600}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>取消</Button>,
          <Button key="save" type="primary" onClick={handleSave}>保存</Button>
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="模板名称" name="name" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="请输入模板名称" />
          </Form.Item>
          <Form.Item label="分类" name="category" rules={[{ required: true, message: '请选择分类' }]}>
            <Select>
              <Select.Option value="基础">基础</Select.Option>
              <Select.Option value="标准">标准</Select.Option>
              <Select.Option value="高级">高级</Select.Option>
              <Select.Option value="测试">测试</Select.Option>
              <Select.Option value="导入">导入</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="模板描述" />
          </Form.Item>
          <Form.Item label="配置内容 (JSON)" name="configContent">
            <Input.TextArea rows={10} placeholder="JSON配置内容" />
          </Form.Item>
          <Form.Item label="导入配置">
            <Upload beforeUpload={handleImport} showUploadList={false} accept=".json">
              <Button icon={<UploadOutlined />}>导入JSON文件</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Templates;
