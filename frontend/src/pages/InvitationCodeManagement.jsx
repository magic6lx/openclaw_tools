import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  InputNumber,
  message,
  Tag,
  Popconfirm,
  Tabs,
  Input,
  Progress,
  Tooltip,
  Select,
  DatePicker,
  Typography,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  StopOutlined,
  CheckOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import invitationCodeService from '../services/invitationCodeService';
import { authService } from '../services/auth';
import dayjs from 'dayjs';

const { TabPane } = Tabs;
const { Option } = Select;
const { Text } = Typography;

function InvitationCodeManagement() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewDrawerVisible, setViewDrawerVisible] = useState(false);
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [expiryModalVisible, setExpiryModalVisible] = useState(false);
  const [selectedCode, setSelectedCode] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [form] = Form.useForm();
  const [tokenForm] = Form.useForm();
  const [expiryForm] = Form.useForm();

  // 检查是否为管理员
  const user = authService.getUser();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      loadCodes();
    }
  }, [activeTab, isAdmin]);

  const loadCodes = async () => {
    setLoading(true);
    try {
      const response = await invitationCodeService.getAllCodes(activeTab);
      
      if (response.success) {
        setCodes(response.data.codes || []);
      } else {
        message.error(response.message || '加载邀请码失败');
      }
    } catch (error) {
      message.error('加载邀请码失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await invitationCodeService.generateCode(
        values.max_devices,
        values.tokens_limit,
        values.expires_in_months,
        values.api_key,
        values.requests_limit
      );

      if (response.success) {
        message.success('邀请码生成成功');
        // 显示临时密钥信息
        if (response.data?.tempApiKey) {
          Modal.info({
            title: '邀请码生成成功',
            content: (
              <div>
                <p><strong>邀请码：</strong>{response.data.code}</p>
                <p><strong>临时API密钥ID：</strong>{response.data.tempApiKey.keyId}</p>
                <p><strong>临时API密钥：</strong>{response.data.tempApiKey.secretKey}</p>
                <p style={{ color: '#999', fontSize: '12px', marginTop: '10px' }}>
                  请保存好临时API密钥，它只会显示一次！
                </p>
              </div>
            ),
            width: 500,
          });
        }
        setModalVisible(false);
        form.resetFields();
        loadCodes();
      } else {
        message.error(response.message || '生成邀请码失败');
      }
    } catch (error) {
      message.error('生成邀请码失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (code) => {
    try {
      const response = await invitationCodeService.disableCode(code);

      if (response.success) {
        message.success('邀请码已禁用');
        loadCodes();
      } else {
        message.error(response.message || '禁用邀请码失败');
      }
    } catch (error) {
      message.error('禁用邀请码失败');
    }
  };

  const handleEnable = async (code) => {
    try {
      const response = await invitationCodeService.enableCode(code);

      if (response.success) {
        message.success('邀请码已启用');
        loadCodes();
      } else {
        message.error(response.message || '启用邀请码失败');
      }
    } catch (error) {
      message.error('启用邀请码失败');
    }
  };

  const handleViewDevices = async (code) => {
    try {
      const response = await invitationCodeService.getDevices(code);

      if (response.success) {
        setSelectedCode(response.data);
        setViewDrawerVisible(true);
      } else {
        message.error(response.message || '获取设备列表失败');
      }
    } catch (error) {
      message.error('获取设备列表失败');
    }
  };

  const handleUnbindDevice = async (userId) => {
    try {
      const response = await invitationCodeService.unbindDevice(userId);

      if (response.success) {
        message.success('设备解绑成功');
        if (selectedCode && selectedCode.invitationCode) {
          handleViewDevices(selectedCode.invitationCode.code);
        }
      } else {
        message.error(response.message || '解绑设备失败');
      }
    } catch (error) {
      message.error('解绑设备失败');
    }
  };

  const handleUpdateTokens = async () => {
    try {
      const values = await tokenForm.validateFields();
      setLoading(true);

      const response = await invitationCodeService.updateTokensLimit(
        selectedCode.code,
        values.tokens_limit
      );

      if (response.success) {
        message.success('token限制更新成功');
        setTokenModalVisible(false);
        tokenForm.resetFields();
        loadCodes();
      } else {
        message.error(response.message || '更新token限制失败');
      }
    } catch (error) {
      message.error('更新token限制失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateExpiry = async () => {
    try {
      const values = await expiryForm.validateFields();
      setLoading(true);

      const response = await invitationCodeService.updateExpiryDate(
        selectedCode.code,
        values.expires_in_months
      );

      if (response.success) {
        message.success('过期时间更新成功');
        setExpiryModalVisible(false);
        expiryForm.resetFields();
        loadCodes();
      } else {
        message.error(response.message || '更新过期时间失败');
      }
    } catch (error) {
      message.error('更新过期时间失败');
    } finally {
      setLoading(false);
    }
  };

  const openTokenModal = (record) => {
    setSelectedCode(record);
    tokenForm.setFieldsValue({
      tokens_limit: record.tokens_limit,
    });
    setTokenModalVisible(true);
  };

  const openExpiryModal = (record) => {
    setSelectedCode(record);
    expiryForm.setFieldsValue({
      expires_in_months: 3,
    });
    setExpiryModalVisible(true);
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date() > new Date(expiresAt);
  };

  const getTokenProgress = (used, limit) => {
    const percentage = ((used / limit) * 100).toFixed(2);
    return {
      percentage: parseFloat(percentage),
      status: percentage > 80 ? 'exception' : percentage > 50 ? 'active' : 'success',
    };
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '邀请码',
      dataIndex: 'code',
      key: 'code',
      render: (code) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status, record) => {
        const expired = isExpired(record.expires_at);
        if (expired) {
          return <Tag color="error">已过期</Tag>;
        }
        return (
          <Tag color={status === 'active' ? 'success' : 'error'}>
            {status === 'active' ? '激活' : '禁用'}
          </Tag>
        );
      },
    },
    {
      title: '设备数',
      dataIndex: 'current_devices',
      key: 'current_devices',
      width: 100,
      render: (current, record) => `${current}/${record.max_devices}`,
    },
    {
      title: 'Token使用',
      key: 'tokens',
      width: 200,
      render: (_, record) => {
        const progress = getTokenProgress(record.tokens_used, record.tokens_limit);
        return (
          <Tooltip title={`${record.tokens_used} / ${record.tokens_limit} tokens`}>
            <Progress
              percent={progress.percentage}
              status={progress.status}
              size="small"
            />
          </Tooltip>
        );
      },
    },
    {
      title: '请求次数',
      key: 'requests',
      width: 120,
      render: (_, record) => (
        <Tooltip title={`${record.requests_used || 0} / ${record.requests_limit || 10} 次请求`}>
          <Tag color={((record.requests_used || 0) / (record.requests_limit || 10)) > 0.8 ? 'error' : 'success'}>
            {record.requests_used || 0}/{record.requests_limit || 10}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: '临时密钥',
      key: 'temp_api_key',
      width: 120,
      render: (_, record) => (
        record.api_key_id ? (
          <Button
            type="primary"
            size="small"
            icon={<KeyOutlined />}
            onClick={() => {
              const textToCopy = `KeyID: ${record.api_key_id}\nSecret: ${record.api_secret_key}`;
              navigator.clipboard.writeText(textToCopy).then(() => {
                message.success('API密钥已复制到剪贴板');
              }).catch(() => {
                message.error('复制失败，请手动复制');
              });
            }}
          >
            一键复制
          </Button>
        ) : (
          <Tag color="default">未生成</Tag>
        )
      ),
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 180,
      render: (date) => date ? new Date(date).toLocaleString() : '永久',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 350,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDevices(record.code)}
          >
            查看设备
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openTokenModal(record)}
          >
            Token限制
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openExpiryModal(record)}
          >
            过期时间
          </Button>
          {record.status === 'active' ? (
            <Popconfirm
              title="确认禁用"
              description="确定要禁用此邀请码吗？禁用后用户将无法登录。"
              onConfirm={() => handleDisable(record.code)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger icon={<StopOutlined />}>
                禁用
              </Button>
            </Popconfirm>
          ) : (
            <Button
              type="link"
              icon={<CheckOutlined />}
              onClick={() => handleEnable(record.code)}
            >
              启用
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const deviceColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '设备名称',
      dataIndex: 'device_name',
      key: 'device_name',
    },
    {
      title: '操作系统',
      dataIndex: 'os_type',
      key: 'os_type',
      width: 120,
    },
    {
      title: '系统版本',
      dataIndex: 'os_version',
      key: 'os_version',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : 'default'}>
          {status === 'active' ? '激活' : '未激活'}
        </Tag>
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      width: 180,
      render: (date) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="确认解绑"
          description="确定要解绑此设备吗？"
          onConfirm={() => handleUnbindDevice(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            解绑
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // 非管理员显示无权限提示
  if (!isAdmin) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <Alert
            message="无权访问"
            description="您没有权限访问邀请码管理页面。请联系管理员获取帮助。"
            type="warning"
            showIcon
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Card
        title="邀请码管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            生成邀请码
          </Button>
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="全部" key="all" />
          <TabPane tab="激活" key="active" />
          <TabPane tab="禁用" key="disabled" />
        </Tabs>

        <Table
          columns={columns}
          dataSource={codes}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title="生成邀请码"
        open={modalVisible}
        onOk={handleCreate}
        onCancel={() => setModalVisible(false)}
        confirmLoading={loading}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="最大设备数"
            name="max_devices"
            rules={[{ required: true, message: '请输入最大设备数' }]}
            initialValue={3}
          >
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="Token使用上限"
            name="tokens_limit"
            rules={[{ required: true, message: '请输入token使用上限' }]}
            initialValue={50000}
            tooltip="默认5W token，用户使用超过此限制将无法继续使用"
          >
            <InputNumber min={1000} max={1000000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="过期时间（月）"
            name="expires_in_months"
            rules={[{ required: true, message: '请输入过期时间' }]}
            initialValue={3}
            tooltip="邀请码的有效期，默认3个月"
          >
            <InputNumber min={1} max={120} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="请求次数上限"
            name="requests_limit"
            rules={[{ required: true, message: '请输入请求次数上限' }]}
            initialValue={10}
            tooltip="临时API密钥的请求次数限制，默认10次"
          >
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="更新Token限制"
        open={tokenModalVisible}
        onOk={handleUpdateTokens}
        onCancel={() => setTokenModalVisible(false)}
        confirmLoading={loading}
      >
        <Form form={tokenForm} layout="vertical">
          <Form.Item
            label="Token使用上限"
            name="tokens_limit"
            rules={[{ required: true, message: '请输入token使用上限' }]}
            tooltip="更新token使用上限，用户使用超过此限制将无法继续使用"
          >
            <InputNumber min={1000} max={1000000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="更新过期时间"
        open={expiryModalVisible}
        onOk={handleUpdateExpiry}
        onCancel={() => setExpiryModalVisible(false)}
        confirmLoading={loading}
      >
        <Form form={expiryForm} layout="vertical">
          <Form.Item
            label="过期时间（月）"
            name="expires_in_months"
            rules={[{ required: true, message: '请输入过期时间' }]}
            tooltip="邀请码的有效期，从现在开始计算"
          >
            <InputNumber min={1} max={120} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="设备列表"
        open={viewDrawerVisible}
        onCancel={() => setViewDrawerVisible(false)}
        footer={null}
        width={800}
      >
        {selectedCode && (
          <div>
            <p>
              <strong>邀请码:</strong> <Tag color="blue">{selectedCode.code}</Tag>
              <span style={{ marginLeft: 16 }}>
                <strong>设备数:</strong> {selectedCode.devices?.length || 0}/{selectedCode.max_devices}
              </span>
              <span style={{ marginLeft: 16 }}>
                <strong>Token使用:</strong> {selectedCode.tokens_used} / {selectedCode.tokens_limit}
              </span>
            </p>
            <Table
              columns={deviceColumns}
              dataSource={selectedCode.devices || []}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

export default InvitationCodeManagement;