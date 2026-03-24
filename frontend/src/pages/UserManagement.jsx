import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Descriptions,
  Input,
  Select,
} from 'antd';
import {
  EyeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
  });

  useEffect(() => {
    loadUsers();
  }, [filters]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users');
      const data = response.data;
      
      let filteredUsers = data.users || [];
      
      if (filters.status !== 'all') {
        filteredUsers = filteredUsers.filter(user => user.status === filters.status);
      }
      
      if (filters.search) {
        const search = filters.search.toLowerCase();
        filteredUsers = filteredUsers.filter(user => 
          user.device_name?.toLowerCase().includes(search) ||
          user.device_id?.toLowerCase().includes(search) ||
          user.invitationCode?.code?.toLowerCase().includes(search)
        );
      }
      
      setUsers(filteredUsers);
    } catch (error) {
      console.error('加载用户失败:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (user) => {
    setSelectedUser(user);
    setViewModalVisible(true);
  };

  const getStatusColor = (status) => {
    return status === 'active' ? 'success' : 'default';
  };

  const getOSTagColor = (osType) => {
    const colors = {
      'Windows': 'blue',
      'macOS': 'green',
      'Linux': 'orange',
      'Android': 'purple',
      'iOS': 'red',
    };
    return colors[osType] || 'default';
  };

  const columns = [
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
      title: '设备ID',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 200,
      ellipsis: true,
    },
    {
      title: '操作系统',
      dataIndex: 'os_type',
      key: 'os_type',
      width: 100,
      render: (osType) => (
        <Tag color={getOSTagColor(osType)}>{osType || '未知'}</Tag>
      ),
    },
    {
      title: '系统版本',
      dataIndex: 'os_version',
      key: 'os_version',
      width: 150,
      ellipsis: true,
    },
    {
      title: '邀请码',
      dataIndex: ['invitationCode', 'code'],
      key: 'invitationCode',
      width: 120,
      render: (code) => code ? <Tag color="blue">{code}</Tag> : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
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
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="用户管理"
        extra={
          <Space>
            <Input
              placeholder="搜索设备名称、ID或邀请码"
              prefix={<SearchOutlined />}
              style={{ width: 250 }}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              allowClear
            />
            <Select
              style={{ width: 120 }}
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              <Option value="all">全部状态</Option>
              <Option value="active">激活</Option>
              <Option value="inactive">未激活</Option>
            </Select>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title="用户详情"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {selectedUser && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="用户ID" span={2}>
                {selectedUser.id}
              </Descriptions.Item>
              <Descriptions.Item label="设备名称" span={2}>
                {selectedUser.device_name}
              </Descriptions.Item>
              <Descriptions.Item label="设备ID" span={2}>
                {selectedUser.device_id}
              </Descriptions.Item>
              <Descriptions.Item label="操作系统">
                <Tag color={getOSTagColor(selectedUser.os_type)}>
                  {selectedUser.os_type || '未知'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="系统版本">
                {selectedUser.os_version || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="邀请码" span={2}>
                <Tag color="blue">{selectedUser.invitationCode?.code || '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={getStatusColor(selectedUser.status)}>
                  {selectedUser.status === 'active' ? '激活' : '未激活'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="最后登录">
                {selectedUser.last_login_at 
                  ? new Date(selectedUser.last_login_at).toLocaleString() 
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="注册时间" span={2}>
                {new Date(selectedUser.created_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
            
            {selectedUser.hardware_info && (
              <div style={{ marginTop: 16 }}>
                <h4>硬件信息</h4>
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 4,
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {typeof selectedUser.hardware_info === 'string'
                    ? selectedUser.hardware_info
                    : JSON.stringify(selectedUser.hardware_info, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default UserManagement;