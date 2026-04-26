import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Button, Tag, Space, Modal, message, Spin, Descriptions, Divider, Table, Popconfirm, Select } from 'antd';
import { CheckCircleOutlined, ReloadOutlined, RocketOutlined, SaveOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const LAUNCHER_API = 'http://127.0.0.1:3003';
const SERVER_API = 'http://127.0.0.1:3002';

function Config() {
  const [localConfig, setLocalConfig] = useState(null);
  const [configEnv, setConfigEnv] = useState(null);
  const [configSource, setConfigSource] = useState(null);
  const [configPath, setConfigPath] = useState(null);
  const [envPath, setEnvPath] = useState(null);
  const [keyPaths, setKeyPaths] = useState({});
  const [templates, setTemplates] = useState([]);
  const [privateTemplates, setPrivateTemplates] = useState([]);
  const [selectedPrivateTemplate, setSelectedPrivateTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const fetchLocalConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${LAUNCHER_API}/config/export`);
      const data = await res.json();
      if (data.success) {
        setLocalConfig(data.config);
        setConfigEnv(data.env);
        setConfigSource(data.source);
        setConfigPath(data.configPath);
        setEnvPath(data.envPath);
        setKeyPaths(data.keyPaths || {});
        message.success(`已同步 (${data.source})`);
      } else {
        message.error(data.message || '获取本地配置失败');
      }
    } catch (err) {
      message.error(`无法连接 Launcher: ${err.message}`);
    }
    setLoading(false);
  };

  const fetchTemplates = async () => {
    try {
      const [presetsRes, approvedRes] = await Promise.all([
        fetch(`${SERVER_API}/api/config/presets`),
        fetch(`${SERVER_API}/api/templates/approved`)
      ]);
      const presetsData = await presetsRes.json();
      const approvedData = await approvedRes.json();

      const presets = presetsData.success ? (presetsData.data || []) : [];
      const approvedTemplates = approvedData.success ? (approvedData.data || []) : [];

      const allTemplates = [...approvedTemplates, ...presets];
      setTemplates(allTemplates);
    } catch (err) {
      console.error('获取模板失败:', err);
      try {
        const res = await fetch(`${SERVER_API}/api/config/presets`);
        const data = await res.json();
        if (data.success) {
          setTemplates(data.data || []);
        }
      } catch (e) {
        console.error('获取预设模板失败:', e);
      }
    }
  };

  const fetchPrivateTemplates = async () => {
    try {
      const res = await fetch(`${LAUNCHER_API}/config/private-templates`);
      const data = await res.json();
      if (data.success && data.templates) {
        setPrivateTemplates(data.templates);
        if (data.templates.length > 0 && !selectedPrivateTemplate) {
          setSelectedPrivateTemplate(data.templates[0]);
        }
      } else {
        setPrivateTemplates([]);
      }
    } catch (err) {
      console.error('获取私有模板失败:', err);
    }
  };

  useEffect(() => {
    fetchLocalConfig();
    fetchTemplates();
    fetchPrivateTemplates();
  }, []);

  const handleSavePrivateTemplate = () => {
    if (!localConfig) {
      message.warning('请先刷新获取当前配置');
      return;
    }

    Modal.confirm({
      title: '保存为私有模板',
      icon: <SaveOutlined />,
      content: (
        <div>
          <Paragraph>确定要将当前配置保存为私有模板吗？</Paragraph>
          <Paragraph type="secondary">
            私有模板会保存在本地，可以在任何时候恢复到当前保存的状态。
          </Paragraph>
        </div>
      ),
      onOk: async () => {
        setSyncing(true);
        try {
          const res = await fetch(`${LAUNCHER_API}/config/private-template`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              config: localConfig,
              env: configEnv,
              label: '我的私有配置',
              description: `保存于 ${new Date().toLocaleString()}`
            })
          });
          const data = await res.json();
          if (data.success) {
            message.success('已保存为私有模板');
            fetchPrivateTemplates();
          } else {
            message.error(data.error || '保存失败');
          }
        } catch (err) {
          message.error(`保存失败: ${err.message}`);
        }
        setSyncing(false);
      }
    });
  };

  const handleApplyPrivateTemplate = () => {
    if (!selectedPrivateTemplate) return;

    Modal.confirm({
      title: '恢复私有模板',
      icon: <CheckCircleOutlined />,
      content: (
        <div>
          <Paragraph>确定要恢复私有模板吗？</Paragraph>
          <Descriptions size="small" column={1} style={{ marginTop: 16 }}>
            <Descriptions.Item label="保存时间">
              {new Date(selectedPrivateTemplate.savedAt).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
          <Paragraph type="warning" style={{ marginTop: 16 }}>
            注意：这会覆盖当前配置，可能需要重启 Gateway
          </Paragraph>
        </div>
      ),
      onOk: async () => {
        setApplying(true);
        try {
          const res = await fetch(`${LAUNCHER_API}/config/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: selectedPrivateTemplate.config, env: selectedPrivateTemplate.env })
          });
          const data = await res.json();
          if (data.success) {
            message.success('已恢复私有模板');
            fetchLocalConfig();
          } else {
            message.error(data.error || '恢复失败');
          }
        } catch (err) {
          message.error(`恢复失败: ${err.message}`);
        }
        setApplying(false);
      }
    });
  };

  const handleDeletePrivateTemplate = (id) => {
    Modal.confirm({
      title: '删除私有模板',
      icon: <DeleteOutlined />,
      content: '确定要删除私有模板吗？删除后无法恢复。',
      onOk: async () => {
        try {
          const res = await fetch(`${LAUNCHER_API}/config/private-template/${id}`, {
            method: 'DELETE'
          });
          const data = await res.json();
          if (data.success) {
            message.success('私有模板已删除');
            fetchPrivateTemplates();
          } else {
            message.error(data.error || '删除失败');
          }
        } catch (err) {
          message.error(`删除失败: ${err.message}`);
        }
      }
    });
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
            <Descriptions.Item label="描述">{template.description}</Descriptions.Item>
          </Descriptions>
          <Paragraph type="warning" style={{ marginTop: 16 }}>
            注意：应用模板会覆盖当前配置，已自动保存当前配置为私有模板
          </Paragraph>
        </div>
      ),
      onOk: async () => {
        setApplying(true);
        try {
          if (localConfig) {
            await fetch(`${LAUNCHER_API}/config/private-template`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                config: localConfig,
                env: configEnv,
                label: '应用模板前的备份',
                description: `在应用"${template.label}"前自动保存`
              })
            });
          }
          const res = await fetch(`${LAUNCHER_API}/config/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: template.config, env: template.env })
          });
          const data = await res.json();
          if (data.success) {
            message.success('模板已应用');
            fetchLocalConfig();
            fetchPrivateTemplates();
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

  const configColumns = [
    { title: '配置项', dataIndex: 'key', key: 'key', width: 200 },
    { title: '值', dataIndex: 'value', key: 'value', ellipsis: true }
  ];

  const getConfigData = () => {
    if (!localConfig) return [];
    const items = [];
    const flatten = (obj, prefix = '') => {
      for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          flatten(obj[key], fullKey);
        } else {
          items.push({ key: fullKey, value: String(obj[key]) });
        }
      }
    };
    flatten(localConfig);
    return items;
  };

  const getTagColor = (category) => {
    switch (category) {
      case '推荐': return 'blue';
      case '基础': return 'cyan';
      case '高级': return 'orange';
      case '企业': return 'purple';
      case '私有': return 'green';
      default: return 'default';
    }
  };

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>配置管理</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchLocalConfig} loading={loading}>
          刷新
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={14}>
          <Card
            title="OpenClaw核心配置"
            extra={
              <Space>
                {configSource === 'openclaw' && <Tag color="blue">OpenClaw配置</Tag>}
                {configSource === 'default' && <Tag color="orange">默认配置</Tag>}
                {localConfig && <Tag color="green">已加载</Tag>}
              </Space>
            }
          >
            {configPath && (
              <Descriptions size="small" column={1} style={{ marginBottom: 12 }}>
                <Descriptions.Item label="配置文件">
                  <Text type="secondary" style={{ fontSize: 11 }} copyable={{ text: configPath }}>
                    {configPath}
                  </Text>
                </Descriptions.Item>
                {envPath && (
                  <Descriptions.Item label="密钥文件">
                    <Text type="secondary" style={{ fontSize: 11 }} copyable={{ text: envPath }}>
                      {configEnv ? '✓ 已存在' : '✗ 不存在'}
                    </Text>
                  </Descriptions.Item>
                )}
              </Descriptions>
            )}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
                <Paragraph style={{ marginTop: 16 }}>正在获取本地配置...</Paragraph>
              </div>
            ) : localConfig ? (
              <Table
                size="small"
                columns={configColumns}
                dataSource={getConfigData()}
                pagination={{ pageSize: 15 }}
                scroll={{ y: 350 }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">点击「刷新」按钮获取本地配置</Text>
              </div>
            )}
          </Card>

          <Card
            size="small"
            style={{ marginTop: 16 }}
            title="其他关键配置"
          >
            <Row gutter={[16, 12]}>
              {Object.entries(keyPaths).map(([name, info]) => (
                <Col span={12} key={name}>
                  <Card
                    size="small"
                    style={{
                      background: info.exists ? '#f6ffed' : '#fff2f0',
                      borderColor: info.exists ? '#52c41a' : '#ff4d4f'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Text strong style={{ fontSize: 16 }}>
                        {name === 'workspace' && '📁'}
                        {name === 'agents' && '🤖'}
                        {name === 'skills' && '💡'}
                        {name === 'channels' && '📱'}
                        {name === 'tools' && '🔧'}
                        {name === 'plugins' && '🔌'}
                        {name === 'logs' && '📋'}
                        {name === 'canvas' && '🎨'}
                      </Text>
                      <Text strong>{name}/</Text>
                      {info.exists ? (
                        <Tag color="success">存在</Tag>
                      ) : (
                        <Tag color="error">不存在</Tag>
                      )}
                    </div>
                    {info.exists ? (
                      <div style={{ fontSize: 11, color: '#666' }}>
                        {info.agentWorkspaces && info.agentWorkspaces.length > 0 && (
                          <div style={{ color: '#1890ff', marginBottom: 4 }}>
                            Agent工作区: {info.agentWorkspaces.slice(0, 5).join(', ')}
                            {info.agentWorkspaces.length > 5 ? ` 等${info.agentWorkspaces.length}个` : ''}
                          </div>
                        )}
                        {info.configWorkspaceDir && (
                          <div style={{ color: '#52c41a', marginBottom: 4 }}>
                            配置路径: {info.configWorkspaceDir}
                          </div>
                        )}
                        {info.subDirs.length > 0 && (
                          <div>子目录: {info.subDirs.slice(0, 5).join(', ')}{info.more ? ` 等${info.subDirs.length}个` : ''}</div>
                        )}
                        {info.files.length > 0 && (
                          <div>文件: {info.files.slice(0, 5).join(', ')}{info.more ? ` 等${info.files.length + (info.more || 0)}个` : ''}</div>
                        )}
                      </div>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 11 }}>点击「刷新」后会自动检测</Text>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>

          {privateTemplates.length > 0 && (
            <Card
              style={{ marginTop: 16, borderColor: '#52c41a' }}
              title={
                <Space>
                  <Text>📁 私有模板</Text>
                  <Tag color="green">{privateTemplates.length}个</Tag>
                </Space>
              }
              extra={
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSavePrivateTemplate}
                  loading={syncing}
                >
                  保存当前
                </Button>
              }
            >
              <Select
                style={{ width: '100%', marginBottom: 16 }}
                placeholder="选择要恢复的私有模板"
                value={selectedPrivateTemplate?.id}
                onChange={(id) => {
                  const tpl = privateTemplates.find(t => t.id === id);
                  setSelectedPrivateTemplate(tpl);
                }}
              >
                {privateTemplates.map(tpl => (
                  <Select.Option key={tpl.id} value={tpl.id}>
                    {tpl.label} - {new Date(tpl.savedAt).toLocaleString()}
                  </Select.Option>
                ))}
              </Select>
              {selectedPrivateTemplate && (
                <>
                  <Descriptions size="small" column={2}>
                    <Descriptions.Item label="保存时间">
                      {new Date(selectedPrivateTemplate.savedAt).toLocaleString()}
                    </Descriptions.Item>
                    <Descriptions.Item label="描述">
                      {selectedPrivateTemplate.description}
                    </Descriptions.Item>
                  </Descriptions>
                  <Divider style={{ margin: '12px 0' }} />
                  <Space>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={handleApplyPrivateTemplate}
                      loading={applying}
                    >
                      恢复此配置
                    </Button>
                    <Popconfirm
                      title="确定删除此私有模板？"
                      onConfirm={() => handleDeletePrivateTemplate(selectedPrivateTemplate.id)}
                      okText="删除"
                      cancelText="取消"
                    >
                      <Button danger icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                </>
              )}
            </Card>
          )}

          {privateTemplates.length === 0 && localConfig && (
            <Card
              style={{ marginTop: 16 }}
              title="保存私有模板"
            >
              <Paragraph type="secondary">
                将当前配置保存为私有模板，方便随时恢复。支持保存多个版本。
              </Paragraph>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSavePrivateTemplate}
                loading={syncing}
              >
                保存当前配置为私有模板
              </Button>
            </Card>
          )}
        </Col>

        <Col span={10}>
          <Card title="模版应用选择">
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              从预设模板中选择，快速配置 OpenClaw
            </Paragraph>
            <div style={{ maxHeight: 500, overflow: 'auto' }}>
              {templates.map((template) => (
                <Card
                  key={template.id}
                  size="small"
                  hoverable
                  style={{ marginBottom: 12 }}
                  actions={[
                    <Button
                      type="primary"
                      size="small"
                      icon={<RocketOutlined />}
                      onClick={() => handleApplyTemplate(template)}
                      loading={applying && selectedTemplate?.id === template.id}
                    >
                      应用
                    </Button>
                  ]}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontSize: 24 }}>{template.icon}</Text>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong>{template.label}</Text>
                        <Tag size="small" color={getTagColor(template.category)}>{template.category}</Tag>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{template.description}</Text>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} title="使用说明">
        <ul style={{ marginBottom: 0 }}>
          <li><Text strong>刷新</Text>：从本地 OpenClaw 配置目录获取最新配置</li>
          <li><Text strong>导出</Text>：将当前配置保存为 JSON 文件备份</li>
          <li><Text strong>导入</Text>：从 JSON 文件加载配置并应用到本地 OpenClaw</li>
          <li><Text strong>保存私有模板</Text>：将当前配置保存到本地，方便随时恢复</li>
          <li><Text strong>恢复私有模板</Text>：将之前保存的私有模板应用到 OpenClaw</li>
          <li><Text strong>预设模板</Text>：选择预设模板快速配置，部分模板需要重启 Gateway</li>
        </ul>
      </Card>
    </div>
  );
}

export default Config;