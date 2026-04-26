import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Button, Tag, Space, Modal, message, Spin, Descriptions, Divider, Table, Upload } from 'antd';
import { CheckCircleOutlined, ReloadOutlined, SyncOutlined, RocketOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const LAUNCHER_API = 'http://127.0.0.1:3003';
const SERVER_API = 'http://127.0.0.1:3002';

function Config() {
  const [localConfig, setLocalConfig] = useState(null);
  const [templates, setTemplates] = useState([]);
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
        message.success('本地配置已同步');
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

  useEffect(() => {
    fetchLocalConfig();
    fetchTemplates();
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
            导出配置
          </Button>
          <Upload
            beforeUpload={handleImportConfig}
            showUploadList={false}
            accept=".json"
          >
            <Button icon={<UploadOutlined />} loading={syncing}>
              导入配置
            </Button>
          </Upload>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={14}>
          <Card
            title="当前本地配置"
            extra={
              localConfig && (
                <Tag color="green">已加载</Tag>
              )
            }
          >
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
                scroll={{ y: 450 }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">点击「刷新」按钮获取本地配置</Text>
              </div>
            )}
          </Card>
        </Col>

        <Col span={10}>
          <Card title="快速应用模板">
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              从预设模板中选择，快速配置 OpenClaw
            </Paragraph>
            <div style={{ maxHeight: 480, overflow: 'auto' }}>
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
          <li><Text strong>刷新</Text>：从本地 Launcher 获取最新配置</li>
          <li><Text strong>导出</Text>：将当前配置保存为 JSON 文件备份</li>
          <li><Text strong>导入</Text>：从 JSON 文件加载配置并应用到本地</li>
          <li><Text strong>模板</Text>：选择预设模板快速配置，部分模板需要重启 Gateway</li>
        </ul>
      </Card>
    </div>
  );
}

export default Config;