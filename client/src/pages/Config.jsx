import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Button, Tag, Space, Modal, message, Spin, Descriptions, Divider, Table, Upload, Popconfirm } from 'antd';
import { CheckCircleOutlined, ReloadOutlined, SyncOutlined, RocketOutlined, DownloadOutlined, UploadOutlined, SaveOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const LAUNCHER_API = 'http://127.0.0.1:3003';
const SERVER_API = 'http://127.0.0.1:3002';

function Config() {
  const [localConfig, setLocalConfig] = useState(null);
  const [configEnv, setConfigEnv] = useState(null);
  const [configSource, setConfigSource] = useState(null);
  const [configPath, setConfigPath] = useState(null);
  const [envPath, setEnvPath] = useState(null);
  const [directories, setDirectories] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [privateTemplate, setPrivateTemplate] = useState(null);
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
        setDirectories(data.directories || []);
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
      const res = await fetch(`${SERVER_API}/api/config/presets`);
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data || []);
      }
    } catch (err) {
      console.error('获取模板失败:', err);
    }
  };

  const fetchPrivateTemplate = async () => {
    try {
      const res = await fetch(`${LAUNCHER_API}/config/private-template`);
      const data = await res.json();
      if (data.success && data.hasTemplate) {
        setPrivateTemplate(data.template);
      } else {
        setPrivateTemplate(null);
      }
    } catch (err) {
      console.error('获取私有模板失败:', err);
    }
  };

  useEffect(() => {
    fetchLocalConfig();
    fetchTemplates();
    fetchPrivateTemplate();
  }, []);

  const handleExportConfig = () => {
    if (!localConfig) return;
    const blob = new Blob([JSON.stringify(localConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openclaw-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('配置已导出');
  };

  const handleImportConfig = async (file) => {
    try {
      const text = await file.text();
      const config = JSON.parse(text);

      Modal.confirm({
        title: '确认导入配置',
        content: '确定要将此配置应用到本地 OpenClaw 吗？',
        onOk: async () => {
          setSyncing(true);
          try {
            const res = await fetch(`${LAUNCHER_API}/config/import`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ config })
            });
            const data = await res.json();
            if (data.success) {
              message.success('配置已应用');
              fetchLocalConfig();
              fetchPrivateTemplate();
            } else {
              message.error(data.error || '应用配置失败');
            }
          } catch (err) {
            message.error(`导入失败: ${err.message}`);
          }
          setSyncing(false);
        }
      });
    } catch (err) {
      message.error(`解析配置文件失败: ${err.message}`);
    }
    return false;
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
          const res = await fetch(`${LAUNCHER_API}/config/private-template`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              config: localConfig,
              label: '我的私有配置',
              description: `保存于 ${new Date().toLocaleString()}`
            })
          });
          const data = await res.json();
          if (data.success) {
            message.success('已保存为私有模板');
            fetchPrivateTemplate();
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
    if (!privateTemplate) return;

    Modal.confirm({
      title: '恢复私有模板',
      icon: <CheckCircleOutlined />,
      content: (
        <div>
          <Paragraph>确定要恢复私有模板吗？</Paragraph>
          <Descriptions size="small" column={1} style={{ marginTop: 16 }}>
            <Descriptions.Item label="保存时间">
              {new Date(privateTemplate.savedAt).toLocaleString()}
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
            body: JSON.stringify({ config: privateTemplate.config })
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

  const handleDeletePrivateTemplate = () => {
    Modal.confirm({
      title: '删除私有模板',
      icon: <DeleteOutlined />,
      content: '确定要删除私有模板吗？删除后无法恢复。',
      onOk: async () => {
        try {
          const res = await fetch(`${LAUNCHER_API}/config/private-template`, {
            method: 'DELETE'
          });
          const data = await res.json();
          if (data.success) {
            message.success('私有模板已删除');
            setPrivateTemplate(null);
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
            注意：应用模板会覆盖当前配置，可能需要重启 Gateway
          </Paragraph>
        </div>
      ),
      onOk: async () => {
        setApplying(true);
        try {
          const res = await fetch(`${LAUNCHER_API}/config/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: template.config })
          });
          const data = await res.json();
          if (data.success) {
            message.success('模板已应用');
            fetchLocalConfig();
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
        <div>
          <Title level={2}>本地配置</Title>
          <Paragraph type="secondary">管理本地 OpenClaw 的配置和模板</Paragraph>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchLocalConfig} loading={loading}>
            刷新
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportConfig} disabled={!localConfig}>
            导出
          </Button>
          <Upload
            beforeUpload={handleImportConfig}
            showUploadList={false}
            accept=".json"
          >
            <Button icon={<UploadOutlined />} loading={syncing}>
              导入
            </Button>
          </Upload>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={14}>
          <Card
            title="当前本地配置"
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

          {directories.length > 0 && (
            <Card
              size="small"
              style={{ marginTop: 16 }}
              title="OpenClaw 目录内容"
            >
              <Space wrap>
                {directories.map(dir => (
                  <Tag key={dir} color={dir.startsWith('.') ? 'default' : 'blue'}>
                    {dir}
                  </Tag>
                ))}
              </Space>
            </Card>
          )}

          {privateTemplate && (
            <Card
              style={{ marginTop: 16, borderColor: '#52c41a' }}
              title={
                <Space>
                  <Text>📁 私有模板</Text>
                  <Tag color="green">已保存</Tag>
                </Space>
              }
              extra={
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
                    title="确定删除私有模板？"
                    onConfirm={handleDeletePrivateTemplate}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              }
            >
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="保存时间">
                  {new Date(privateTemplate.savedAt).toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="描述">
                  {privateTemplate.description}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          {!privateTemplate && localConfig && (
            <Card
              style={{ marginTop: 16 }}
              title="保存私有模板"
            >
              <Paragraph type="secondary">
                将当前配置保存为私有模板，方便随时恢复。
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
          <Card title="快速应用模板">
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