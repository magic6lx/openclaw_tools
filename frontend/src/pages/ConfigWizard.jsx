import React, { useState, useEffect } from 'react';
import { Steps, Card, Button, Form, Input, Select, message, Spin, Alert, Tabs, Table, Tag, Popconfirm, Drawer, Descriptions, Space } from 'antd';
import { ArrowRightOutlined, ArrowLeftOutlined, CheckOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ExportOutlined, ImportOutlined, EyeOutlined } from '@ant-design/icons';
import { recommendationService } from '../services/recommendation';
import { userConfigService } from '../services/userConfig';
import invitationCodeService from '../services/invitationCodeService';
import { authService } from '../services/auth';

const { Step } = Steps;
const { Option } = Select;
const { TabPane } = Tabs;

function ConfigWizard() {
  const [activeTab, setActiveTab] = useState('wizard');
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
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
  const [customConfig, setCustomConfig] = useState({});
  const [form] = Form.useForm();
  
  const [configs, setConfigs] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewDrawerVisible, setViewDrawerVisible] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  
  // 邀请码相关状态
  const [invitationCode, setInvitationCode] = useState('');
  const [apiConfig, setApiConfig] = useState(null);
  const [invitationCodeForm] = Form.useForm();
  const [hasApiConfig, setHasApiConfig] = useState(false);

  useEffect(() => {
    loadRecommendations();
    loadConfigs();
    checkUserApiConfig();
  }, []);

  // 检查用户是否已有API配置
  const checkUserApiConfig = async () => {
    try {
      const user = authService.getUser();
      if (user?.api_config?.api_key_id) {
        setApiConfig({
          ...user.api_config,
          proxy_url: '/api/proxy/proxy-by-code'
        });
        setHasApiConfig(true);
        // 自动跳到下一步
        setCurrent(1);
      }
    } catch (error) {
      console.error('检查API配置失败:', error);
    }
  };

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

  // 处理邀请码激活
  const handleActivateInvitationCode = async () => {
    try {
      const values = await invitationCodeForm.validateFields();
      setLoading(true);
      
      const response = await invitationCodeService.getConfigByCode(values.invitation_code);
      
      if (response.success) {
        setApiConfig(response.data);
        setInvitationCode(values.invitation_code);
        message.success('邀请码激活成功！API配置已自动获取');
      } else {
        message.error(response.message || '邀请码激活失败');
      }
    } catch (error) {
      message.error('邀请码激活失败');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: '邀请码激活',
      content: (
        <div>
          {hasApiConfig ? (
            <Alert
              message="API配置已自动获取"
              description={
                <div>
                  <p>您已使用邀请码登录，API配置已自动加载。</p>
                  <p><strong>API Key ID:</strong> {apiConfig?.api_key_id}</p>
                  <p><strong>Token限额:</strong> {apiConfig?.tokens_limit}</p>
                  <p><strong>请求次数限额:</strong> {apiConfig?.requests_limit}</p>
                  <p style={{ color: '#52c41a', marginTop: 12 }}>✓ 可以直接进入下一步</p>
                </div>
              }
              type="success"
              showIcon
              style={{ marginBottom: 24 }}
            />
          ) : (
            <>
              <Alert
                message="输入邀请码"
                description="请输入您的邀请码以获取API访问配置"
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
              />
              <Form
                form={invitationCodeForm}
                layout="vertical"
              >
                <Form.Item
                  label="邀请码"
                  name="invitation_code"
                  rules={[{ required: true, message: '请输入邀请码' }]}
                >
                  <Input.Search
                    placeholder="例如: HGKDBQUSUAJ"
                    enterButton="激活"
                    onSearch={handleActivateInvitationCode}
                    loading={loading}
                  />
                </Form.Item>
              </Form>
            </>
          )}
          
          {!hasApiConfig && apiConfig && (
            <Alert
              message="API配置已获取"
              description={
                <div>
                  <p><strong>API Key ID:</strong> {apiConfig.api_key_id}</p>
                  <p><strong>Token限额:</strong> {apiConfig.tokens_limit}</p>
                  <p><strong>请求次数限额:</strong> {apiConfig.requests_limit}</p>
                  <p style={{ color: '#52c41a' }}>✓ 配置已自动保存，继续下一步即可</p>
                </div>
              }
              type="success"
              showIcon
              style={{ marginTop: 24 }}
            />
          )}
        </div>
      ),
    },
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
              message={`为您推荐了 ${recommendations.length} 个配置模版`}
              description="根据您的环境信息智能推荐"
              type="success"
              showIcon
              style={{ marginBottom: 24 }}
            />
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {recommendations.map((template) => (
                <Card
                  key={template.id}
                  style={{ marginBottom: 16, cursor: 'pointer' }}
                  onClick={() => setSelectedTemplate(template)}
                  hoverable
                  type={selectedTemplate?.id === template.id ? 'inner' : 'default'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <h4>{template.name}</h4>
                      <p style={{ color: '#666', margin: 0 }}>{template.description}</p>
                      <div style={{ marginTop: 8 }}>
                        <span style={{ marginRight: 16 }}>匹配度: {template.recommendation_score.toFixed(0)}%</span>
                        <span style={{ color: '#999' }}>{template.match_reason}</span>
                      </div>
                    </div>
                    {selectedTemplate?.id === template.id && (
                      <CheckOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </Spin>
        </div>
      ),
    },
    {
      title: '自定义配置',
      content: (
        <div>
          <Alert
            message="自定义配置"
            description="您可以根据需要调整配置参数"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
          <Form
            layout="vertical"
            onValuesChange={(_, allValues) => setCustomConfig(allValues)}
          >
            <Form.Item label="超时时间(ms)" name="timeout">
              <Input type="number" placeholder="默认: 30000" />
            </Form.Item>
            <Form.Item label="最大重试次数" name="max_retries">
              <Input type="number" placeholder="默认: 3" />
            </Form.Item>
            <Form.Item label="内存限制(GB)" name="memory_limit">
              <Input type="number" placeholder="默认: 4" />
            </Form.Item>
            <Form.Item label="启用日志" name="enable_logging" valuePropName="checked">
              <Select defaultValue={true}>
                <Option value={true}>是</Option>
                <Option value={false}>否</Option>
              </Select>
            </Form.Item>
          </Form>
        </div>
      ),
    },
    {
      title: '完成',
      content: (
        <div>
          <Alert
            message="配置已准备就绪"
            description="确认以下配置信息后点击完成"
            type="success"
            showIcon
            style={{ marginBottom: 24 }}
          />
          <Card>
            <h4>选中的模版</h4>
            <p><strong>名称:</strong> {selectedTemplate?.name}</p>
            <p><strong>描述:</strong> {selectedTemplate?.description}</p>
            <p><strong>版本:</strong> {selectedTemplate?.version}</p>
            <hr style={{ margin: '16px 0' }} />
            <h4>自定义配置</h4>
            <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
              {JSON.stringify(customConfig, null, 2)}
            </pre>
          </Card>
        </div>
      ),
    },
  ];

  const next = () => {
    if (current === 2 && !selectedTemplate) {
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
      const response = await userConfigService.applyTemplate(
        selectedTemplate.id,
        customConfig
      );
      if (response.success) {
        message.success('配置应用成功');
        setCurrent(0);
        setSelectedTemplate(null);
        setCustomConfig({});
      }
    } catch (error) {
      message.error('配置应用失败');
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
        </TabPane>
      </Tabs>
    </div>
  );
}

export default ConfigWizard;