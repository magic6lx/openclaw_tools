import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Tag,
  Popconfirm,
  Drawer,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  ExportOutlined,
  ImportOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { userConfigService } from '../services/userConfig';

function ConfigManagement() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewDrawerVisible, setViewDrawerVisible] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const response = await userConfigService.getUserConfigs();
      if (response.success) {
        setConfigs(response.data);
      }
    } catch (error) {
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (configId) => {
    try {
      const response = await userConfigService.activateConfig(configId);
      if (response.success) {
        message.success('配置已激活');
        loadConfigs();
      }
    } catch (error) {
      message.error('激活配置失败');
    }
  };

  const handleDelete = async (configId) => {
    try {
      const response = await userConfigService.deleteConfig(configId);
      if (response.success) {
        message.success('配置已删除');
        loadConfigs();
      }
    } catch (error) {
      message.error('删除配置失败');
    }
  };

  const handleExport = async (configId) => {
    try {
      const response = await userConfigService.exportConfig(configId);
      if (response.success) {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `config_${configId}.json`;
        link.click();
        message.success('配置已导出');
      }
    } catch (error) {
      message.error('导出配置失败');
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const configData = JSON.parse(event.target.result);
          const response = await userConfigService.importConfig(configData);
          if (response.success) {
            message.success('配置已导入');
            loadConfigs();
          }
        } catch (error) {
          message.error('导入配置失败');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleView = (config) => {
    setSelectedConfig(config);
    setViewDrawerVisible(true);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '模版',
      dataIndex: ['template', 'name'],
      key: 'template',
      render: (text) => text || '自定义',
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'default'}>
          {isActive ? '已激活' : '未激活'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          {!record.is_active && (
            <Button
              type="link"
              icon={<CheckOutlined />}
              onClick={() => handleActivate(record.id)}
            >
              激活
            </Button>
          )}
          <Button
            type="link"
            icon={<ExportOutlined />}
            onClick={() => handleExport(record.id)}
          >
            导出
          </Button>
          {!record.is_active && (
            <Popconfirm
              title="确认删除"
              description="确定要删除此配置吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="配置管理"
        extra={
          <Space>
            <Button
              icon={<ImportOutlined />}
              onClick={handleImport}
            >
              导入配置
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={configs}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Drawer
        title="配置详情"
        placement="right"
        width={600}
        onClose={() => setViewDrawerVisible(false)}
        open={viewDrawerVisible}
      >
        {selectedConfig && (
          <div>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="ID">{selectedConfig.id}</Descriptions.Item>
              <Descriptions.Item label="模版">
                {selectedConfig.template?.name || '自定义'}
              </Descriptions.Item>
              <Descriptions.Item label="版本">{selectedConfig.version}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={selectedConfig.is_active ? 'green' : 'default'}>
                  {selectedConfig.is_active ? '已激活' : '未激活'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(selectedConfig.created_at).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <h4>配置内容</h4>
              <pre
                style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 4,
                  maxHeight: 400,
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(selectedConfig.config_content, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default ConfigManagement;