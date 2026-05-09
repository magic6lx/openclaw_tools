import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Button, Tag, Space, Modal, message, Spin, Descriptions, Divider, Popconfirm, Select, Checkbox, Switch, Table, Tooltip, Collapse } from 'antd';
import { CheckCircleOutlined, ReloadOutlined, RocketOutlined, SaveOutlined, DeleteOutlined, LinuxOutlined, ClearOutlined, CameraOutlined, UndoOutlined, HistoryOutlined, AppstoreOutlined, EyeOutlined } from '@ant-design/icons';
import QuickSettings from '../components/QuickSettings';
import { useConfig } from '../hooks/useConfig';

const { Title, Text, Paragraph } = Typography;
import { LAUNCHER_API, launcherFetch } from '../utils/launcher';
const SERVER_API = import.meta.env.VITE_API_BASE_URL || '';

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
  const [snapshots, setSnapshots] = useState([]);
  const [applyRecords, setApplyRecords] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [templateDetail, setTemplateDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [applyingWithCategories, setApplyingWithCategories] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState('templates');
  const [coreConfigCollapsed, setCoreConfigCollapsed] = useState(true);

  const fetchProxyState = async () => {
    let serverEnabled = false;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${SERVER_API}/api/proxy/state`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        serverEnabled = data.enabled;
        setProxyEnabled(data.enabled);
      }
    } catch (err) {
      console.error('获取代理状态失败:', err);
    }

    try {
      const launcherRes = await launcherFetch(`/config/proxy`);
      const launcherData = await launcherRes.json();
      if (launcherData.success && launcherData.enabled !== serverEnabled) {
        setProxyEnabled(launcherData.enabled);
      }
    } catch (err) {
      // launcher not running, ignore
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
        try {
          const launcherRes = await launcherFetch(`/config/proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              enabled: checked,
              serverUrl: SERVER_API || window.location.origin,
              userToken: token
            })
          });
          const launcherData = await launcherRes.json();
          if (!launcherData.success) {
            message.warning(`服务端代理已${checked ? '启用' : '关闭'}，但本地配置更新失败: ${launcherData.error}`);
          }
        } catch (launcherErr) {
          message.warning(`服务端代理已${checked ? '启用' : '关闭'}，但本地配置更新失败（Launcher 未运行）`);
        }
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
      const res = await launcherFetch(`/api/cli/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'openclaw doctor --fix --non-interactive' })
      });
      const data = await res.json();
      if (data.success) {
        message.success('配置已清理完成');
        fetchConfig();
      } else {
        message.error(data.error || '清理失败');
      }
    } catch (err) {
      message.error(`清理失败: ${err.message}`);
    } finally {
      setSanitizing(false);
    }
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
      const res = await launcherFetch(`/config/private-templates`);
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
    fetchSnapshots();
    fetchApplyRecords();
  }, []);

  const fetchSnapshots = async () => {
    try {
      const res = await launcherFetch(`/template/snapshots`);
      const data = await res.json();
      if (data.success) {
        setSnapshots(data.snapshots || []);
      }
    } catch (err) {
      console.error('获取快照列表失败:', err);
    }
  };

  const fetchApplyRecords = async () => {
    try {
      const res = await launcherFetch(`/template/apply-records`);
      const data = await res.json();
      if (data.success) {
        setApplyRecords(data.records || []);
      }
    } catch (err) {
      console.error('获取应用记录失败:', err);
    }
  };

  const fetchTemplateDetail = async (templateId) => {
    setDetailLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${SERVER_API}/api/templates/${templateId}/full`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setTemplateDetail(data.data);
        setSelectedCategories(data.data.categories || []);
      } else {
        message.error(data.error || '获取模板详情失败');
      }
    } catch (err) {
      message.error(`获取模板详情失败: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApplyWithCategories = async () => {
    if (selectedCategories.length === 0) {
      message.warning('请至少选择一个分类');
      return;
    }
    if (!templateDetail) return;

    Modal.confirm({
      title: '确认应用模板',
      icon: <RocketOutlined />,
      content: (
        <div>
          <Paragraph>将应用模板 <Text strong>{templateDetail.name}</Text> 的以下分类：</Paragraph>
          <div style={{ marginTop: 8 }}>
            {selectedCategories.map(cat => (
              <Tag key={cat} color="blue" style={{ marginBottom: 4 }}>{cat}</Tag>
            ))}
          </div>
          <Paragraph type="warning" style={{ marginTop: 16 }}>
            系统将在应用前自动创建快照，可随时回滚。
          </Paragraph>
        </div>
      ),
      onOk: async () => {
        setApplyingWithCategories(true);
        try {
          const token = localStorage.getItem('token');
          const res = await launcherFetch(`/template/apply`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-server-token': token || ''
            },
            body: JSON.stringify({
              templateId: templateDetail.id,
              selectedCategories,
              configPaths: true
            }),
            timeout: 120000
          });
          const data = await res.json();
          if (data.success) {
            message.success(`模板已应用：写入 ${data.applied?.filesWritten || 0} 个文件`);
            fetchConfig();
            fetchSnapshots();
            fetchApplyRecords();
            setSelectedCategories([]);
            setTemplateDetail(null);

            setTimeout(() => {
              Modal.confirm({
                title: '模型访问配置',
                icon: <RocketOutlined />,
                content: (
                  <div>
                    <Paragraph>模板已成功应用！现在需要配置模型访问方式，请选择：</Paragraph>
                    <Paragraph type="secondary" style={{ fontSize: 12 }}>
                      💡 推荐：开启 Token 代理可共享服务端大模型，无需单独配置 API Key
                    </Paragraph>
                  </div>
                ),
                okText: '开启 Token 代理（推荐）',
                cancelText: '跳过，稍后配置',
                onOk: async () => {
                  await handleToggleProxy(true);
                }
              });
            }, 500);
          } else {
            message.error(data.error || '应用失败');
          }
        } catch (err) {
          message.error(`应用失败: ${err.message}`);
        } finally {
          setApplyingWithCategories(false);
        }
      }
    });
  };

  const handleRollback = async (snapshotId) => {
    Modal.confirm({
      title: '确认回滚',
      icon: <UndoOutlined />,
      content: (
        <div>
          <Paragraph>确定要回滚到此快照的状态吗？</Paragraph>
          <Paragraph type="warning">回滚将恢复快照中的所有文件和配置，删除应用后新增的文件。</Paragraph>
        </div>
      ),
      onOk: async () => {
        setRollingBack(true);
        try {
          const res = await launcherFetch(`/template/snapshot/${snapshotId}/rollback`, {
            method: 'POST'
          });
          const data = await res.json();
          if (data.success) {
            message.success(`回滚成功：恢复 ${data.restoredCount || 0} 个文件，删除 ${data.deletedCount || 0} 个新增文件`);
            fetchConfig();
            fetchSnapshots();
          } else {
            message.error(data.error || '回滚失败');
          }
        } catch (err) {
          message.error(`回滚失败: ${err.message}`);
        }
        setRollingBack(false);
      }
    });
  };

  const handleDeleteSnapshot = async (snapshotId) => {
    try {
      const res = await launcherFetch(`/template/snapshot/${snapshotId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        message.success('快照已删除');
        fetchSnapshots();
      } else {
        message.error(data.error || '删除失败');
      }
    } catch (err) {
      message.error(`删除失败: ${err.message}`);
    }
  };

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
          const res = await launcherFetch(`/config/private-template`, {
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
          const res = await launcherFetch(`/config/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: selectedPrivateTemplate.config, env: selectedPrivateTemplate.env, fileContents: selectedPrivateTemplate.filePayload })
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
          const res = await launcherFetch(`/config/private-template/${id}`, {
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
            await launcherFetch(`/config/private-template`, {
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
          const res = await launcherFetch(`/config/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: partialConfig, env: template.env, fileContents: template.filePayload })
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
                <Button size="small" type="text" onClick={() => setCoreConfigCollapsed(!coreConfigCollapsed)}>
                  {coreConfigCollapsed ? '展开' : '收起'}
                </Button>
              </Space>
            }
          >
            {!coreConfigCollapsed && (
              <>
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
              </>
            )}
            {coreConfigCollapsed && (
              <div style={{ textAlign: 'center', padding: 16 }}>
                <Text type="secondary">配置已折叠，点击"展开"查看详情</Text>
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
                  保存当前配置
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
          <Card 
            title={
              <Space>
                <AppstoreOutlined />
                <span>共享模版</span>
              </Space>
            }
            extra={
              <Space size="small">
                <Button 
                  size="small" 
                  type={activeRightTab === 'templates' ? 'primary' : 'default'}
                  onClick={() => setActiveRightTab('templates')}
                >
                  模板
                </Button>
                <Button 
                  size="small" 
                  type={activeRightTab === 'snapshots' ? 'primary' : 'default'}
                  onClick={() => setActiveRightTab('snapshots')}
                >
                  快照
                </Button>
                <Button 
                  size="small" 
                  type={activeRightTab === 'records' ? 'primary' : 'default'}
                  onClick={() => setActiveRightTab('records')}
                >
                  记录
                </Button>
              </Space>
            }
          >
            {activeRightTab === 'templates' && (
              <>
                {!templateDetail ? (
                  <>
                    <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                      选择一个模板，按分类勾选后应用
                    </Paragraph>
                    <div style={{ maxHeight: 500, overflow: 'auto' }}>
                      {templates.map(template => (
                        <Card
                          key={template.id}
                          size="small"
                          hoverable
                          style={{ marginBottom: 12 }}
                          onClick={() => fetchTemplateDetail(template.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Text style={{ fontSize: 28 }}>{template.icon}</Text>
                            <div style={{ flex: 1 }}>
                              <Text strong>{template.label || template.name}</Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: 12 }}>{template.description}</Text>
                            </div>
                            <EyeOutlined style={{ color: '#1890ff' }} />
                          </div>
                        </Card>
                      ))}
                      {templates.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                          <Text type="secondary">暂无已发布的模板</Text>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {detailLoading ? (
                      <div style={{ textAlign: 'center', padding: 40 }}>
                        <Spin size="large" />
                        <Paragraph style={{ marginTop: 16 }}>加载模板详情...</Paragraph>
                      </div>
                    ) : (
                      <>
                        <Button type="link" onClick={() => { setTemplateDetail(null); setSelectedCategories([]); }} style={{ padding: 0, marginBottom: 12 }}>
                          ← 返回模板列表
                        </Button>
                        <div style={{ marginBottom: 16 }}>
                          <Text strong style={{ fontSize: 16 }}>{templateDetail.name}</Text>
                          {templateDetail.description && (
                            <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>{templateDetail.description}</Paragraph>
                          )}
                        </div>

                        <Divider style={{ margin: '12px 0' }}>选择要应用的分类</Divider>

                        <div style={{ border: '1px solid #d9d9d9', borderRadius: 4, padding: 12, maxHeight: 300, overflow: 'auto' }}>
                          {(templateDetail.categories || []).map(cat => (
                            <div key={cat.name} style={{ marginBottom: 8, padding: '4px 8px', background: selectedCategories.includes(cat.name) ? '#e6f7ff' : '#fafafa', borderRadius: 4 }}>
                              <Checkbox
                                checked={selectedCategories.includes(cat.name)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCategories([...selectedCategories, cat.name]);
                                  } else {
                                    setSelectedCategories(selectedCategories.filter(c => c !== cat.name));
                                  }
                                }}
                              >
                                <Text strong>{cat.label || cat.name}</Text>
                                <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                                  {cat.paths?.join(', ')}
                                </Text>
                                {cat.source === 'discovered' && <Tag color="blue" style={{ marginLeft: 4 }}>自动发现</Tag>}
                                {cat.source === 'preset' && <Tag color="orange" style={{ marginLeft: 4 }}>预设</Tag>}
                              </Checkbox>
                            </div>
                          ))}
                          {(templateDetail.categories || []).length === 0 && (
                            <Text type="secondary">此模板暂无分类信息</Text>
                          )}
                        </div>

                        <div style={{ marginTop: 8 }}>
                          <Button type="link" size="small" onClick={() => setSelectedCategories((templateDetail.categories || []).map(c => c.name))}>全选</Button>
                          <Button type="link" size="small" onClick={() => setSelectedCategories([])}>清空</Button>
                        </div>

                        <Divider />

                        {templateDetail.fileList && Object.keys(templateDetail.fileList).length > 0 && (
                          <Collapse size="small" style={{ marginBottom: 12 }}>
                            <Collapse.Panel header={`文件清单 (${Object.values(templateDetail.fileList).flat().length} 个文件)`} key="files">
                              {Object.entries(templateDetail.fileList).map(([cat, files]) => (
                                <div key={cat} style={{ marginBottom: 8 }}>
                                  <Text strong style={{ fontSize: 12 }}>{cat}:</Text>
                                  <div style={{ paddingLeft: 12 }}>
                                    {files.map(f => (
                                      <Text key={f} type="secondary" style={{ fontSize: 11, display: 'block' }}>{f}</Text>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </Collapse.Panel>
                          </Collapse>
                        )}

                        <Space>
                          <Button
                            type="primary"
                            icon={<RocketOutlined />}
                            onClick={handleApplyWithCategories}
                            loading={applyingWithCategories}
                            disabled={selectedCategories.length === 0}
                          >
                            应用 ({selectedCategories.length} 个分类)
                          </Button>
                          <Button onClick={() => { setTemplateDetail(null); setSelectedCategories([]); }}>
                            重选
                          </Button>
                        </Space>
                        {applyingWithCategories && (
                          <div style={{ marginTop: 12 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              <Spin size="small" style={{ marginRight: 8 }} />
                              正在应用模板，请稍候...
                            </Text>
                            <br />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              💡 如文件较多可能需要较长时间，请勿关闭页面
                            </Text>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                <Divider style={{ margin: '16px 0' }} />
              </>
            )}

            {activeRightTab === 'snapshots' && (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <CameraOutlined />
                  <Text strong>应用快照</Text>
                  <Tag color="blue">{snapshots.length}个</Tag>
                  <Button size="small" icon={<ReloadOutlined />} onClick={fetchSnapshots}>刷新</Button>
                </Space>
                {snapshots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <CameraOutlined style={{ fontSize: 32, color: '#d9d9d9' }} />
                    <Paragraph type="secondary" style={{ marginTop: 12 }}>暂无快照</Paragraph>
                    <Text type="secondary" style={{ fontSize: 12 }}>应用模板时会自动创建快照</Text>
                  </div>
                ) : (
                  <div style={{ maxHeight: 500, overflow: 'auto' }}>
                    {snapshots.map(snap => (
                      <Card
                        key={snap.id}
                        size="small"
                        style={{ marginBottom: 8, borderColor: '#d9d9d9' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div>
                            <Text strong>{snap.templateName || '未知模板'}</Text>
                            <br />
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {new Date(snap.createdAt).toLocaleString()}
                            </Text>
                            <br />
                            <Space size={4} style={{ marginTop: 4 }}>
                              <Tag color="blue" style={{ fontSize: 10 }}>{snap.filesCount} 个文件</Tag>
                              <Tag color="green" style={{ fontSize: 10 }}>{snap.newFilesCount} 个新增</Tag>
                            </Space>
                            {snap.selectedCategories && snap.selectedCategories.length > 0 && (
                              <div style={{ marginTop: 4 }}>
                                {snap.selectedCategories.map(cat => (
                                  <Tag key={cat} style={{ fontSize: 10, marginBottom: 2 }}>{cat}</Tag>
                                ))}
                              </div>
                            )}
                          </div>
                          <Space direction="vertical" size={4}>
                            <Tooltip title="回滚到此快照">
                              <Button
                                size="small"
                                icon={<UndoOutlined />}
                                onClick={() => handleRollback(snap.id)}
                                loading={rollingBack}
                              >
                                回滚
                              </Button>
                            </Tooltip>
                            <Popconfirm title="确定删除此快照？" onConfirm={() => handleDeleteSnapshot(snap.id)}>
                              <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                            </Popconfirm>
                          </Space>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeRightTab === 'records' && (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <HistoryOutlined />
                  <Text strong>应用记录</Text>
                  <Tag color="purple">{applyRecords.length}条</Tag>
                  <Button size="small" icon={<ReloadOutlined />} onClick={fetchApplyRecords}>刷新</Button>
                </Space>
                {applyRecords.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <HistoryOutlined style={{ fontSize: 32, color: '#d9d9d9' }} />
                    <Paragraph type="secondary" style={{ marginTop: 12 }}>暂无应用记录</Paragraph>
                  </div>
                ) : (
                  <div style={{ maxHeight: 500, overflow: 'auto' }}>
                    {applyRecords.map(record => (
                      <Card
                        key={record.id}
                        size="small"
                        style={{ marginBottom: 8, borderColor: '#d9d9d9' }}
                      >
                        <div>
                          <Text strong>{record.templateName || '未知模板'}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {new Date(record.appliedAt).toLocaleString()}
                          </Text>
                          <br />
                          <Space size={4} style={{ marginTop: 4 }}>
                            <Tag color="green" style={{ fontSize: 10 }}>写入 {record.filesWritten}</Tag>
                            <Tag color="orange" style={{ fontSize: 10 }}>跳过 {record.filesSkipped}</Tag>
                            {record.errors && record.errors.length > 0 && (
                              <Tag color="red" style={{ fontSize: 10 }}>错误 {record.errors.length}</Tag>
                            )}
                          </Space>
                          {record.selectedCategories && record.selectedCategories.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              {record.selectedCategories.map(cat => (
                                <Tag key={cat} style={{ fontSize: 10, marginBottom: 2 }}>{cat}</Tag>
                              ))}
                            </div>
                          )}
                          {record.configConflicts && record.configConflicts.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              <Text type="secondary" style={{ fontSize: 10 }}>
                                配置冲突: {record.configConflicts.length} 处
                              </Text>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Config;