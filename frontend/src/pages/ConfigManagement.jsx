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
  Tabs,
  Tooltip,
} from 'antd';
import {
  DeleteOutlined,
  CheckOutlined,
  ExportOutlined,
  EyeOutlined,
  HistoryOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { userConfigService } from '../services/userConfig';
import { localLauncherService } from '../services/localLauncherService';

const { TabPane } = Tabs;

function ConfigManagement() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewDrawerVisible, setViewDrawerVisible] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [form] = Form.useForm();
  
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  useEffect(() => {
    loadConfigs();
    loadBackups();
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

  const loadBackups = async () => {
    setBackupsLoading(true);
    try {
      const response = await localLauncherService.listBackups();
      if (response.success) {
        setBackups(response.backups || []);
      }
    } catch (error) {
      console.error('加载备份列表失败', error);
    } finally {
      setBackupsLoading(false);
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

  const handleView = (config) => {
    setSelectedConfig(config);
    setViewDrawerVisible(true);
  };

  const handleRestore = async (backupName) => {
    setRestoreLoading(true);
    try {
      message.loading({ content: '正在恢复配置...', key: 'restore' });
      
      const response = await localLauncherService.restoreConfig(backupName);
      
      if (response.success) {
        message.success({ content: response.message || '配置恢复成功', key: 'restore' });
        loadBackups();
      } else {
        message.error({ content: '恢复失败: ' + (response.error || '未知错误'), key: 'restore' });
      }
    } catch (error) {
      message.error({ content: '恢复失败: ' + error.message, key: 'restore' });
    } finally {
      setRestoreLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  const backupColumns = [
    {
      title: '备份名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Space>
          <ClockCircleOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size) => formatSize(size),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Popconfirm
          title="确认恢复"
          description="恢复将覆盖当前配置，确定要继续吗？"
          onConfirm={() => handleRestore(record.name)}
          okText="确定"
          cancelText="取消"
        >
          <Button 
            type="link" 
            icon={<ReloadOutlined />}
            loading={restoreLoading}
          >
            恢复
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Card title="配置管理">
        <Tabs defaultActiveKey="configs">
          <TabPane 
            tab={
              <span>
                <ExportOutlined />
                配置列表
              </span>
            } 
            key="configs"
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
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <HistoryOutlined />
                备份恢复
              </span>
            } 
            key="backups"
          >
            <div style={{ marginBottom: 16 }}>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={loadBackups}
                loading={backupsLoading}
              >
                刷新列表
              </Button>
            </div>
            
            <Table
              columns={backupColumns}
              dataSource={backups}
              rowKey="name"
              loading={backupsLoading}
              locale={{ emptyText: '暂无备份' }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 个备份`,
              }}
            />
          </TabPane>
        </Tabs>
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
