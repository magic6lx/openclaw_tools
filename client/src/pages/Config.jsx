import React, { useState } from 'react';
import { Card, Typography, Row, Col, Button, Table, Tag, Space, Modal, message, Upload, Spin } from 'antd';
import { DownloadOutlined, UploadOutlined, ReloadOutlined, SyncOutlined, FileTextOutlined, InboxOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const LAUNCHER_API = 'http://127.0.0.1:3003';

function Config() {
  const [localConfig, setLocalConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchLocalConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${LAUNCHER_API}/config/export`);
      const data = await res.json();
      if (data.success) {
        setLocalConfig(data.config);
        message.success('配置已同步');
      } else {
        message.error('获取本地配置失败');
      }
    } catch (err) {
      message.error(`无法连接 Launcher: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportConfig = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${LAUNCHER_API}/config/export`);
      const data = await res.json();
      if (data.success) {
        const blob = new Blob([JSON.stringify(data.config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `openclaw-config-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        message.success('配置已导出');
      } else {
        message.error('导出配置失败');
      }
    } catch (err) {
      message.error(`导出失败: ${err.message}`);
    } finally {
      setSyncing(false);
    }
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
          } finally {
            setSyncing(false);
          }
        }
      });
    } catch (err) {
      message.error(`解析配置文件失败: ${err.message}`);
    }
    return false;
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
    return items.slice(0, 50);
  };

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <Title level={2}>配置管理</Title>
      <Paragraph type="secondary">导入和导出 OpenClaw 本地配置</Paragraph>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card
            title="从本地同步"
            extra={
              <Button icon={<SyncOutlined />} onClick={fetchLocalConfig} loading={loading}>
                刷新
              </Button>
            }
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
                <Paragraph style={{ marginTop: 16 }}>正在获取本地配置...</Paragraph>
              </div>
            ) : localConfig ? (
              <>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Tag color="green">已同步</Tag>
                    <Text type="secondary"> 本地配置已加载</Text>
                  </div>
                  <Table
                    size="small"
                    columns={configColumns}
                    dataSource={getConfigData()}
                    pagination={{ pageSize: 10 }}
                    scroll={{ y: 400 }}
                  />
                </Space>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <InboxOutlined style={{ fontSize: 48, color: '#ccc' }} />
                <Paragraph style={{ marginTop: 16 }}>
                  <Button type="primary" onClick={fetchLocalConfig}>
                    点击同步本地配置
                  </Button>
                </Paragraph>
              </div>
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card title="配置操作">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Card size="small" type="inner" title="导出配置">
                <Paragraph type="secondary">将本地 OpenClaw 配置导出为 JSON 文件</Paragraph>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleExportConfig}
                  loading={syncing}
                  disabled={!localConfig}
                >
                  导出配置
                </Button>
              </Card>

              <Card size="small" type="inner" title="导入配置">
                <Paragraph type="secondary">从 JSON 文件导入配置到本地 OpenClaw</Paragraph>
                <Upload
                  beforeUpload={handleImportConfig}
                  showUploadList={false}
                  accept=".json"
                >
                  <Button icon={<UploadOutlined />} loading={syncing}>
                    选择配置文件
                  </Button>
                </Upload>
              </Card>

              <Card size="small" type="inner" title="配置模板">
                <Paragraph type="secondary">从服务器下载公开的配置模板</Paragraph>
                <Button icon={<FileTextOutlined />} onClick={() => message.info('请从"配置模板"页面选择模板')}>
                  查看配置模板
                </Button>
              </Card>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} title="配置说明">
        <Paragraph>
          <ul>
            <li><Text strong>导入配置</Text>：将 JSON 配置文件应用到本地 OpenClaw，可能需要重启 Gateway</li>
            <li><Text strong>导出配置</Text>：将本地当前配置导出为 JSON，便于分享和备份</li>
            <li><Text strong>敏感信息</Text>：API Keys 等敏感信息在导出时会自动脱敏</li>
          </ul>
        </Paragraph>
      </Card>
    </div>
  );
}

export default Config;
