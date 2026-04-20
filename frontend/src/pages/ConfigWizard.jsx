import React, { useState, useEffect } from 'react';
import { Steps, Card, Button, Form, Input, Select, message, Spin, Alert, Tabs, Table, Tag, Popconfirm, Drawer, Descriptions, Space } from 'antd';
import { ArrowRightOutlined, ArrowLeftOutlined, CheckOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ExportOutlined, EyeOutlined } from '@ant-design/icons';
import { recommendationService } from '../services/recommendation';
import { userConfigService } from '../services/userConfig';
import localLauncherService from '../services/localLauncherService';
import { configTemplateService } from '../services/configTemplate';

const { Step } = Steps;
const { Option } = Select;
const { TabPane } = Tabs;

function ConfigWizard() {
  const [activeTab, setActiveTab] = useState('wizard');
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [approvedTemplates, setApprovedTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [environmentInfo, setEnvironmentInfo] = useState({
    os_type: 'Windows',
    os_version: '10.0',
    hardware_info: {
      cpu: { cores: 4, frequency: 2.5 },
      memory: 8,
      storage: 256,
    },
    network_info: {
      bandwidth: 100,
      latency: 20,
    },
  });
  const [form] = Form.useForm();
  
  const [configs, setConfigs] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewDrawerVisible, setViewDrawerVisible] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);

  useEffect(() => {
    loadRecommendations();
    loadConfigs();
    loadApprovedTemplates();
  }, []);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const response = await recommendationService.getRecommendations(environmentInfo);
      if (response.success) {
        setRecommendations(response.data.recommendations);
      }
    } catch (error) {
      message.error('获取推荐配置失败');
    } finally {
      setLoading(false);
    }
  };

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

  const loadApprovedTemplates = async () => {
    try {
      const response = await configTemplateService.getTemplates({ status: 'approved' });
      if (response.success) {
        setApprovedTemplates(response.data.templates || []);
      }
    } catch (error) {
      console.error('加载已审核模板失败:', error);
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

  const steps = [
    {
      title: '环境检测',
      content: (
        <div>
          <Alert
            message="系统环境信息"
            description="以下信息已自动检测，您可以手动修改"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
          <Form
            form={form}
            layout="vertical"
            initialValues={environmentInfo}
            onValuesChange={(_, allValues) => setEnvironmentInfo(allValues)}
          >
            <Form.Item label="操作系统类型" name="os_type">
              <Select>
                <Option value="Windows">Windows</Option>
                <Option value="macOS">macOS</Option>
                <Option value="Linux">Linux</Option>
              </Select>
            </Form.Item>
            <Form.Item label="系统版本" name="os_version">
              <Input placeholder="例如: 10.0.19041" />
            </Form.Item>
            <Form.Item label="CPU核心数" name={['hardware_info', 'cpu', 'cores']}>
              <Input type="number" />
            </Form.Item>
            <Form.Item label="内存(GB)" name={['hardware_info', 'memory']}>
              <Input type="number" />
            </Form.Item>
            <Form.Item label="网络带宽(Mbps)" name={['network_info', 'bandwidth']}>
              <Input type="number" />
            </Form.Item>
          </Form>
        </div>
      ),
    },
    {
      title: '选择配置',
      content: (
        <div>
          <Spin spinning={loading}>
            <Alert
              message={`可用配置模板 (${approvedTemplates.length} 个)`}
              description="选择一个已审核通过的配置模板应用到本地"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {approvedTemplates.length === 0 ? (
                <Alert
                  message="暂无可用模板"
                  description="请先在模板管理中导入配置并审核通过"
                  type="warning"
                  showIcon
                />
              ) : (
                approvedTemplates.map((template) => (
                  <Card
                    key={template.id}
                    style={{ marginBottom: 16, cursor: 'pointer' }}
                    onClick={() => setSelectedTemplate(template)}
                    hoverable
                    type={selectedTemplate?.id === template.id ? 'inner' : 'default'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ marginBottom: 8 }}>{template.name}</h4>
                        <p style={{ color: '#666', margin: 0, fontSize: 13 }}>
                          {template.description || '暂无描述'}
                        </p>
                        <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                          <Tag color="blue">{template.category || '未分类'}</Tag>
                          <span style={{ marginLeft: 8 }}>版本: {template.version || '1.0'}</span>
                          <span style={{ marginLeft: 16 }}>
                            文件数: {template.config_content?.files?.length || 0}
                          </span>
                        </div>
                      </div>
                      {selectedTemplate?.id === template.id && (
                        <CheckOutlined style={{ color: '#52c41a', fontSize: 20, marginLeft: 16 }} />
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Spin>
        </div>
      ),
    },
    {
      title: '完成',
      content: (
        <div>
          <Alert
            message="配置已准备就绪"
            description="确认以下配置信息后点击完成应用"
            type="success"
            showIcon
            style={{ marginBottom: 24 }}
          />
          <Card>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="模板名称">{selectedTemplate?.name}</Descriptions.Item>
              <Descriptions.Item label="模板描述">{selectedTemplate?.description || '暂无描述'}</Descriptions.Item>
              <Descriptions.Item label="版本">{selectedTemplate?.version || '1.0'}</Descriptions.Item>
              <Descriptions.Item label="分类">{selectedTemplate?.category || '未分类'}</Descriptions.Item>
              <Descriptions.Item label="文件数量">
                {selectedTemplate?.config_content?.files?.length || 0} 个文件
              </Descriptions.Item>
            </Descriptions>
            <Alert
              message="注意：应用配置前会自动备份当前配置"
              type="info"
              showIcon
              style={{ marginTop: 16 }}
            />
          </Card>
        </div>
      ),
    },
  ];

  const next = () => {
    if (current === 1 && !selectedTemplate) {
      message.warning('请选择一个配置模版');
      return;
    }
    setCurrent(current + 1);
  };

  const prev = () => {
    setCurrent(current - 1);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const templateData = selectedTemplate.config_content;
      
      if (!templateData?.files || templateData.files.length === 0) {
        message.warning('模板中没有配置文件');
        setLoading(false);
        return;
      }

      message.loading({ content: '正在备份当前配置...', key: 'applyConfig' });
      
      const backupResult = await localLauncherService.backupConfig();
      
      if (!backupResult.success) {
        message.error({ content: '备份失败: ' + backupResult.error, key: 'applyConfig' });
        setLoading(false);
        return;
      }

      message.loading({ content: '正在写入配置文件...', key: 'applyConfig' });
      
      const statusResult = await localLauncherService.getStatus();
      const openclawDir = statusResult?.openclawDirectory || 'C:/Users/Acer/.openclaw';
      const homeDir = openclawDir.replace(/[\\\/]\.openclaw$/, '').replace(/\\/g, '/');
      
      const convertPlaceholders = (content) => {
        if (!content || typeof content !== 'string') return content;
        
        return content
          .replace(/\{OPENCLAW_HOME\}/g, openclawDir.replace(/\\/g, '/'))
          .replace(/\{HOME\}/g, homeDir)
          .replace(/\{DOCUMENTS\}/g, `${homeDir}/Documents`)
          .replace(/\{DESKTOP\}/g, `${homeDir}/Desktop`);
      };
      
      let successCount = 0;
      let failCount = 0;
      
      for (const file of templateData.files) {
        const convertedContent = convertPlaceholders(file.content);
        
        const writeResult = await localLauncherService.writeConfigFile(
          file.relativePath,
          convertedContent
        );
        
        if (writeResult.success) {
          successCount++;
        } else {
          failCount++;
          console.error(`写入文件失败: ${file.relativePath}`, writeResult.error);
        }
      }
      
      if (failCount === 0) {
        message.success({ 
          content: `配置应用成功！已写入 ${successCount} 个文件，备份: ${backupResult.backupName}`, 
          key: 'applyConfig',
          duration: 5
        });
      } else {
        message.warning({ 
          content: `配置应用完成，${successCount} 个文件成功，${failCount} 个失败`, 
          key: 'applyConfig' 
        });
      }
      
      setCurrent(0);
      setSelectedTemplate(null);
    } catch (error) {
      message.error('配置应用失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="配置向导" key="wizard">
          <Steps current={current} style={{ marginBottom: 32 }}>
            {steps.map((step) => (
              <Step key={step.title} title={step.title} />
            ))}
          </Steps>

          <Card>{steps[current].content}</Card>

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            {current > 0 && (
              <Button style={{ marginRight: 8 }} onClick={prev}>
                <ArrowLeftOutlined /> 上一步
              </Button>
            )}
            {current < steps.length - 1 && (
              <Button type="primary" onClick={next} loading={loading}>
                下一步 <ArrowRightOutlined />
              </Button>
            )}
            {current === steps.length - 1 && (
              <Button type="primary" onClick={handleFinish} loading={loading}>
                完成 <CheckOutlined />
              </Button>
            )}
          </div>
        </TabPane>
        
        <TabPane tab="配置管理" key="management">
          <Card title="配置管理">
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
        </TabPane>
      </Tabs>
    </div>
  );
}

export default ConfigWizard;