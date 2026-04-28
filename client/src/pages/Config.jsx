import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Button, Tag, Space, Modal, message, Spin, Descriptions, Divider, Popconfirm, Select, Checkbox, Switch } from 'antd';
import { CheckCircleOutlined, ReloadOutlined, RocketOutlined, SaveOutlined, DeleteOutlined, LinuxOutlined, ClearOutlined } from '@ant-design/icons';
import QuickSettings from '../components/QuickSettings';
import { useConfig } from '../hooks/useConfig';

const { Title, Text, Paragraph } = Typography;
const LAUNCHER_API = 'http://127.0.0.1:3003';
const SERVER_API = 'http://127.0.0.1:3002';

function Config() {
  const {
    config: localConfig,
    env: configEnv,
    source: configSource,
    configPath,
    envPath,
    keyPaths,
    loading,
    error,
    fetchConfig,
    updateConfig,
    saveConfig
  } = useConfig();

  const [templates, setTemplates] = useState([]);
  const [privateTemplates, setPrivateTemplates] = useState([]);
  const [selectedPrivateTemplate, setSelectedPrivateTemplate] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedConfigKeys, setSelectedConfigKeys] = useState([]);
  const [savingProxy, setSavingProxy] = useState(false);
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [cliLoading, setCliLoading] = useState(false);
  const [cliResults, setCliResults] = useState(null);
  const [sanitizing, setSanitizing] = useState(false);

  const fetchProxyState = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${SERVER_API}/api/proxy/state`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setProxyEnabled(data.enabled);
      }
    } catch (err) {
      console.error('获取代理状态失败:', err);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchTemplates();
    fetchPrivateTemplates();
    fetchProxyState();
  }, []);

  const handleToggleProxy = async (checked) => {
    setSavingProxy(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${SERVER_API}/api/proxy/state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: checked })
      });
      const data = await res.json();
      if (data.success) {
        setProxyEnabled(data.enabled);
        message.success(checked ? '已启用代理' : '已关闭代理');
      } else {
        message.error(data.error || '操作失败');
      }
    } catch (err) {
      message.error(`操作失败: ${err.message}`);
    }
    setSavingProxy(false);
  };

  const handleSanitizeConfig = async () => {
    setSanitizing(true);
    try {
      const res = await fetch(`${LAUNCHER_API}/config/sanitize`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (data.cleaned) {
          message.success(`已清理 ${data.removedKeys.length} 个无效字段: ${data.removedKeys.join(', ')}`);
          fetchConfig();
        } else {
          message.info('配置文件中没有发现无效字段');
        }
      } else {
        message.error(data.error || '清理失败');
      }
    } catch (err) {
      message.error(`清理失败: ${err.message}`);
    }
    setSanitizing(false);
  };

  const handleCliCheck = async () => {
    setCliLoading(true);
    setCliResults(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${SERVER_API}/api/config/cli/all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      setCliResults(data);
    } catch (err) {
      message.error(`CLI检测失败: ${err.message}`);
    }
    setCliLoading(false);
  };

  const fetchTemplates = async () => {
    try {
      const approvedRes = await fetch(`${SERVER_API}/api/templates/approved`);
      const approvedData = await approvedRes.json();

      const approvedTemplates = approvedData.success ? (approvedData.data || []) : [];
      setTemplates(approvedTemplates);
    } catch (err) {
      console.error('获取模板失败:', err);
      setTemplates([]);
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
    fetchConfig();
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
            fetchConfig();
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
    if (selectedConfigKeys.length === 0) {
      message.warning('请先选择要应用的配置项');
      return;
    }

    const partialConfig = {};
    selectedConfigKeys.forEach(key => {
      if (template.config && template.config[key] !== undefined) {
        partialConfig[key] = template.config[key];
      }
    });

    const hasProxyConfig = partialConfig.models?.providers?.volcengine?.baseUrl?.includes('127.0.0.1:3002');

    Modal.confirm({
      title: '确认应用模板',
      icon: <RocketOutlined />,
      content: (
        <div>
          <Paragraph>确定要应用此模板的以下配置项吗？</Paragraph>
          <Descriptions size="small" column={1} style={{ marginTop: 16 }}>
            <Descriptions.Item label="模板名称">{template.label}</Descriptions.Item>
            <Descriptions.Item label="选中配置">
              <Space wrap>
                {selectedConfigKeys.map(key => (
                  <Tag key={key}>{getConfigIcon(key)} {getConfigName(key)}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
            {hasProxyConfig && (
              <Descriptions.Item label="代理设置">
                <Tag color="blue">✓ 使用Token代理（使用管理员配置的Key）</Tag>
              </Descriptions.Item>
            )}
          </Descriptions>
          <Paragraph type="secondary" style={{ marginTop: 16 }}>
            注意：系统会智能合并配置，保留您的敏感信息（API Key等）
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
            body: JSON.stringify({ config: partialConfig, env: template.env })
          });
          const data = await res.json();
          if (data.success) {
            if (data.conflicts && data.conflicts.length > 0) {
              const keptCount = data.conflicts.filter(c => c.action === 'kept_existing').length;
              const adaptedCount = data.conflicts.filter(c => c.action === 'adapted_path').length;
              message.success(`配置已应用，保留${keptCount}项现有配置，适配${adaptedCount}个路径`);
            } else {
              message.success('配置已应用');
            }
            fetchConfig();
            fetchPrivateTemplates();
            setSelectedConfigKeys([]);
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

  const CONFIG_NAME_MAP = {
    gateway: { icon: '🌉', name: '网关' },
    agents: { icon: '🤖', name: 'Agent' },
    session: { icon: '💬', name: '会话' },
    models: { icon: '🧠', name: '模型' },
    channels: { icon: '📱', name: '频道' },
    hooks: { icon: '🔗', name: '钩子' },
    logging: { icon: '📝', name: '日志' },
    browser: { icon: '🌐', name: '浏览器' }
  };

  const getConfigIcon = (key) => CONFIG_NAME_MAP[key]?.icon || '⚙️';
  const getConfigName = (key) => CONFIG_NAME_MAP[key]?.name || key;

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>配置管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchConfig(); fetchTemplates(); }} loading={loading}>
            刷新
          </Button>
          <Button icon={<ClearOutlined />} onClick={handleSanitizeConfig} loading={sanitizing}>
            清理无效配置
          </Button>
          <Button icon={<LinuxOutlined />} onClick={handleCliCheck} loading={cliLoading}>
            CLI检测
          </Button>
        </Space>
      </div>

      <Card
        style={{ marginBottom: 16, background: proxyEnabled ? '#e6f4ff' : '#fffbe6' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong style={{ fontSize: 16 }}>🔄 Token 代理</Text>
            <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
              共享服务端大模型（token有限，只限于快速体验时开启）
            </Paragraph>
          </div>
          <Switch
            checked={proxyEnabled}
            onChange={handleToggleProxy}
            loading={savingProxy}
            disabled={!localConfig}
            checkedChildren="启用"
            unCheckedChildren="关闭"
          />
        </div>
      </Card>

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
              <QuickSettings config={localConfig} disabled={true} />
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">点击「刷新」按钮获取本地配置</Text>
              </div>
            )}
          </Card>

          <Card
            size="small"
            style={{ marginTop: 16 }}
            title="配置文件检测"
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
                        {name === 'logs' && '📋'}
                        {name === 'canvas' && '🎨'}
                        {name === 'flows' && '🔀'}
                        {name === 'subagents' && '👥'}
                        {name === 'tasks' && '📝'}
                        {name === 'memory' && '🧠'}
                        {name === 'media' && '🖼️'}
                      </Text>
                      <Text strong>{name}/</Text>
                      {info.exists ? (
                        <Tag color="success">存在</Tag>
                      ) : (
                        <Tag color="error">不存在</Tag>
                      )}
                    </div>
                    {name === 'workspace' && (
                      <div style={{ fontSize: 11, color: '#666' }}>
                        {localConfig?.agents?.defaults?.workspace && (
                          <div style={{ color: '#722ed1', marginBottom: 4 }}>
                            配置目录: {localConfig.agents.defaults.workspace}
                          </div>
                        )}
                        {info.agentWorkspaces && info.agentWorkspaces.length > 0 && (
                          <div style={{ color: '#1890ff', marginBottom: 4 }}>
                            Agent目录: {info.agentWorkspaces.slice(0, 5).join(', ')}
                            {info.agentWorkspaces.length > 5 ? ` 等${info.agentWorkspaces.length}个` : ''}
                          </div>
                        )}
                        {info.exists ? (
                          <div style={{ color: '#52c41a' }}>目录状态: 存在</div>
                        ) : (
                          <div style={{ color: '#ff4d4f' }}>目录状态: 不存在</div>
                        )}
                      </div>
                    )}
                    {name !== 'workspace' && info.exists && (
                      <div style={{ fontSize: 11, color: '#666' }}>
                        {info.subDirs.length > 0 && (
                          <div>子目录: {info.subDirs.slice(0, 5).join(', ')}{info.more ? ` 等${info.subDirs.length}个` : ''}</div>
                        )}
                        {info.files.length > 0 && (
                          <div>文件: {info.files.slice(0, 5).join(', ')}{info.more ? ` 等${info.files.length + (info.more || 0)}个` : ''}</div>
                        )}
                      </div>
                    )}
                    {name !== 'workspace' && !info.exists && (
                      <Text type="secondary" style={{ fontSize: 11 }}>点击「刷新」后会自动检测</Text>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>

          {cliResults && (
            <Card
              style={{ marginTop: 16, borderColor: '#1890ff' }}
              title={<Text>🔧 CLI 检测结果</Text>}
              extra={<Button size="small" onClick={() => setCliResults(null)}>关闭</Button>}
            >
              {cliResults.success ? (
                <div>
                  {Object.entries(cliResults.results || {}).map(([key, result]) => (
                    <div key={key} style={{ marginBottom: 8, padding: '4px 8px', background: result.success ? '#f6ffed' : '#fff2f0', borderRadius: 4 }}>
                      <Text strong style={{ color: result.success ? '#52c41a' : '#ff4d4f' }}>
                        {result.success ? '✓' : '✗'} {key}:
                      </Text>
                      <Text style={{ marginLeft: 8 }}>{result.success ? result.value : result.error}</Text>
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="danger">{cliResults.error}</Text>
              )}
            </Card>
          )}

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
            {!selectedTemplate ? (
              <>
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  选择一个模板开始配置
                </Paragraph>
                <div style={{ maxHeight: 500, overflow: 'auto' }}>
                  {templates.map(template => (
                    <Card
                      key={template.id}
                      size="small"
                      hoverable
                      style={{ marginBottom: 12 }}
                      onClick={() => {
                        setSelectedTemplate(template);
                        setSelectedConfigKeys([]);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Text style={{ fontSize: 28 }}>{template.icon}</Text>
                        <div style={{ flex: 1 }}>
                          <Text strong>{template.label}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>{template.description}</Text>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <>
                <Button type="link" onClick={() => { setSelectedTemplate(null); setSelectedConfigKeys([]); }}>
                  ← 返回模板列表
                </Button>
                <div style={{ marginTop: 8, marginBottom: 16 }}>
                  <Text strong>已选择: {selectedTemplate.icon} {selectedTemplate.label}</Text>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>快捷选择：</Text>
                  <Space>
                    <Button size="small" onClick={() => setSelectedConfigKeys(['gateway', 'logging'])}>基础</Button>
                    <Button size="small" onClick={() => setSelectedConfigKeys(['gateway', 'agents', 'session', 'models', 'logging'])}>标准</Button>
                    <Button size="small" onClick={() => setSelectedConfigKeys(Object.keys(selectedTemplate.config || {}))}>高级</Button>
                  </Space>
                </div>

                <Divider style={{ margin: '12px 0' }}>或手动选择单项配置</Divider>

                <div style={{ maxHeight: 250, overflow: 'auto', border: '1px solid #d9d9d9', borderRadius: 4, padding: 8 }}>
                  {(Object.keys(selectedTemplate.config || {})).map(key => (
                    <Checkbox
                      key={key}
                      checked={selectedConfigKeys.includes(key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedConfigKeys([...selectedConfigKeys, key]);
                        } else {
                          setSelectedConfigKeys(selectedConfigKeys.filter(k => k !== key));
                        }
                      }}
                      style={{ marginBottom: 4 }}
                    >
                      {getConfigIcon(key)} {getConfigName(key)}
                    </Checkbox>
                  ))}
                </div>
                <div style={{ marginTop: 8 }}>
                  <Button type="link" size="small" onClick={() => setSelectedConfigKeys(Object.keys(selectedTemplate.config || {}))}>全选</Button>
                  <Button type="link" size="small" onClick={() => setSelectedConfigKeys([])}>清空</Button>
                </div>

                <Divider />
                <Space>
                  <Button
                    type="primary"
                    icon={<RocketOutlined />}
                    onClick={() => handleApplyTemplate(selectedTemplate)}
                    loading={applying}
                    disabled={selectedConfigKeys.length === 0}
                  >
                    应用 ({selectedConfigKeys.length})
                  </Button>
                  <Button onClick={() => { setSelectedTemplate(null); setSelectedConfigKeys([]); }}>
                    重选
                  </Button>
                </Space>
              </>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Config;