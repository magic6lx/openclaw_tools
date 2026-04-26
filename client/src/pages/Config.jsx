import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Button, Tag, Space, Modal, message, Spin, Descriptions, Divider } from 'antd';
import { CheckCircleOutlined, ReloadOutlined, SyncOutlined, RocketOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const LAUNCHER_API = 'http://127.0.0.1:3003';
const SERVER_API = 'http://127.0.0.1:3002';

function Config() {
  const [templates, setTemplates] = useState([]);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_API}/api/config/presets`);
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data || []);
      }
    } catch (err) {
      console.error('获取模板失败:', err);
    }
    setLoading(false);
  };

  const fetchCurrentConfig = async () => {
    try {
      const res = await fetch(`${SERVER_API}/api/config/server`);
      const data = await res.json();
      if (data.success) {
        setCurrentConfig(data.data);
      }
    } catch (err) {
      console.error('获取当前配置失败:', err);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchCurrentConfig();
  }, []);

  const checkIfTemplateActive = (template) => {
    if (!currentConfig) return false;
    const t = template.config;
    if (currentConfig.gateway?.port === t.gateway?.port &&
        currentConfig.launcher?.autoStart === t.launcher?.autoStart) {
      return true;
    }
    return false;
  };

  const handleApplyTemplate = (template) => {
    setSelectedTemplate(template);
    Modal.confirm({
      title: '确认应用模板',
      icon: <RocketOutlined />,
      content: (
        <div>
          <Paragraph>确定要应用此模板配置吗？</Paragraph>
          <Descriptions size="small" column={1} style={{ marginTop: 16 }}>
            <Descriptions.Item label="模板名称">{template.label}</Descriptions.Item>
            <Descriptions.Item label="模板描述">{template.description}</Descriptions.Item>
            <Descriptions.Item label="分类">{template.category}</Descriptions.Item>
          </Descriptions>
          <Paragraph type="warning" style={{ marginTop: 16 }}>
            注意：应用模板会覆盖当前配置，可能需要重启 Gateway 服务
          </Paragraph>
        </div>
      ),
      onOk: async () => {
        setApplying(true);
        try {
          const res = await fetch(`${SERVER_API}/api/config/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(template.config)
          });
          const data = await res.json();
          if (data.success) {
            message.success('模板配置已应用');
            fetchCurrentConfig();
          } else {
            message.error(data.error || '应用失败');
          }
        } catch (err) {
          message.error(`应用失败: ${err.message}`);
        }
        setApplying(false);
      }
    });
  };

  const getTemplateIcon = (category) => {
    switch (category) {
      case '推荐': return '⚡';
      case '基础': return '🚀';
      case '高级': return '🔥';
      case '企业': return '🔒';
      default: return '📋';
    }
  };

  const getTagColor = (category) => {
    switch (category) {
      case '推荐': return 'blue';
      case '基础': return 'cyan';
      case '高级': return 'orange';
      case '企业': return 'purple';
      default: return 'default';
    }
  };

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2}>配置模板</Title>
          <Paragraph type="secondary">选择并应用配置模板，简化 OpenClaw 设置流程</Paragraph>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchTemplates} loading={loading}>
            刷新
          </Button>
          <Button icon={<SyncOutlined />} onClick={fetchCurrentConfig}>
            同步当前配置
          </Button>
        </Space>
      </div>

      {currentConfig && (
        <Card style={{ marginBottom: 24 }}>
          <Descriptions title="当前生效配置" size="small" column={4}>
            <Descriptions.Item label="Gateway 端口">
              <Tag>{currentConfig.gateway?.port || '默认'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Launcher 自动启动">
              <Tag color={currentConfig.launcher?.autoStart ? 'green' : 'default'}>
                {currentConfig.launcher?.autoStart ? '是' : '否'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="配置路径">
              <Text type="secondary" style={{ fontSize: 12 }}>{currentConfig._path || '未知'}</Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
          <Paragraph style={{ marginTop: 16 }}>正在加载配置模板...</Paragraph>
        </div>
      ) : templates.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <Text type="secondary">暂无配置模板</Text>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {templates.map((template) => {
            const isActive = checkIfTemplateActive(template);
            return (
              <Col span={8} key={template.id}>
                <Card
                  hoverable
                  style={{
                    border: isActive ? '2px solid #52c41a' : '1px solid #e8e8e8',
                    height: '100%'
                  }}
                  actions={[
                    <Button
                      type="primary"
                      icon={isActive ? <CheckCircleOutlined /> : <RocketOutlined />}
                      onClick={() => !isActive && handleApplyTemplate(template)}
                      disabled={isActive || applying}
                      loading={applying && selectedTemplate?.id === template.id}
                    >
                      {isActive ? '已启用' : '应用'}
                    </Button>
                  ].filter(Boolean)}
                >
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <Text style={{ fontSize: 48 }}>{template.icon || getTemplateIcon(template.category)}</Text>
                  </div>

                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <Title level={4} style={{ margin: 0 }}>{template.label}</Title>
                    <Paragraph type="secondary" style={{ margin: '8px 0' }}>
                      {template.description}
                    </Paragraph>
                    <Tag color={getTagColor(template.category)}>{template.category}</Tag>
                    {isActive && <Tag color="green" style={{ marginLeft: 8 }}>当前生效</Tag>}
                  </div>

                  <Divider style={{ margin: '12px 0' }} />

                  <div style={{ fontSize: 12, color: '#666' }}>
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary">包含组件：</Text>
                    </div>
                    <Space wrap style={{ justifyContent: 'center' }}>
                      {template.config?.gateway?.enabled !== false && (
                        <Tag size="small">Gateway</Tag>
                      )}
                      {template.config?.agents?.defaults && (
                        <Tag size="small">智能体</Tag>
                      )}
                      {template.config?.channels && (
                        <Tag size="small">通道</Tag>
                      )}
                      {template.config?.hooks?.enabled && (
                        <Tag size="small">Webhooks</Tag>
                      )}
                      {template.config?.cron?.enabled && (
                        <Tag size="small">定时任务</Tag>
                      )}
                      {template.config?.secrets?.providers && (
                        <Tag size="small">密钥管理</Tag>
                      )}
                    </Space>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <Card style={{ marginTop: 24 }}>
        <Title level={5}>使用说明</Title>
        <ul style={{ marginBottom: 0 }}>
          <li>选择一个配置模板，点击「应用」按钮即可将模板配置应用到本地 OpenClaw</li>
          <li>应用模板后会覆盖当前配置，请确认后再操作</li>
          <li>「当前生效」标签表示该模板配置正在使用中</li>
          <li>部分模板可能需要重启 Gateway 服务才能完全生效</li>
        </ul>
      </Card>
    </div>
  );
}

export default Config;