import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, Button, Space, Tag, Modal, Form, Input, Select, message, Popconfirm, Divider, Row, Col, Checkbox, Collapse, Tooltip, Switch, Spin, Descriptions } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined, ReloadOutlined, CloudDownloadOutlined, SearchOutlined, SaveOutlined, ExportOutlined, CheckOutlined, CloseOutlined, CodeOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import QuickSettings from '../../components/QuickSettings';
import { useConfig, mergeWithDefaults } from '../../hooks/useConfig';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const LAUNCHER_API = 'http://127.0.0.1:3003';

function Templates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [currentEnv, setCurrentEnv] = useState(null);
  const [pasteModalVisible, setPasteModalVisible] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [serverConfigLoading, setServerConfigLoading] = useState(false);
  const [launcherConfigLoading, setLauncherConfigLoading] = useState(false);
  const [editConfig, setEditConfig] = useState({});
  const [discoverModalVisible, setDiscoverModalVisible] = useState(false);
  const [discoveredCategories, setDiscoveredCategories] = useState([]);
  const [discovering, setDiscovering] = useState(false);
  const [manifestCategories, setManifestCategories] = useState([]);
  const [manifestName, setManifestName] = useState('');
  const [manifests, setManifests] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [verifyingTemplate, setVerifyingTemplate] = useState(null);
  const [selectedManifestForTemplate, setSelectedManifestForTemplate] = useState(null);
  const [viewManifestModalVisible, setViewManifestModalVisible] = useState(false);
  const [viewManifestData, setViewManifestData] = useState(null);
  const [configMigrationModalVisible, setConfigMigrationModalVisible] = useState(false);
  const [configMigrationData, setConfigMigrationData] = useState(null);
  const [configMigrationLoading, setConfigMigrationLoading] = useState(false);
  const [exportFileList, setExportFileList] = useState([]);
  const [showFileListModal, setShowFileListModal] = useState(false);

  const { config: launcherConfig, loading: launcherLoading, fetchConfig: refetchLauncherConfig } = useConfig();

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data || []);
      }
    } catch (err) {
      console.error('获取模板失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchManifests();
  }, []);

  const fetchManifests = async () => {
    try {
      const res = await fetch(`${LAUNCHER_API}/template/manifests`);
      const data = await res.json();
      if (data.success) {
        setManifests(data.manifests || []);
        console.log('[Manifest] 列表已刷新，当前数量:', data.manifests?.length);
      } else {
        console.warn('[Manifest] 获取列表失败:', data.error);
      }
    } catch (err) {
      console.error('[Manifest] 获取列表失败:', err);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    setDiscoverModalVisible(true);
    try {
      const res = await fetch(`${LAUNCHER_API}/template/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success && data.discovered) {
        setDiscoveredCategories(data.discovered.categories || []);
        setManifestCategories((data.discovered.categories || []).map(c => ({ ...c, enabled: true })));
        setManifestName('default');
        addLog('INFO', `动态发现完成: ${data.discovered.categories?.length || 0} 个分类`);
      } else {
        message.error(data.error || '动态发现失败');
      }
    } catch (err) {
      message.error(`动态发现失败: ${err.message}`);
    } finally {
      setDiscovering(false);
    }
  };

  const fetchConfigMigration = async (templateId) => {
    setConfigMigrationLoading(true);
    setConfigMigrationModalVisible(true);
    setConfigMigrationData(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/templates/${templateId}/config-migration`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setConfigMigrationData(data.data);
      } else {
        message.error(data.error || '获取配置迁移规则失败');
      }
    } catch (err) {
      message.error(`获取配置迁移规则失败: ${err.message}`);
    } finally {
      setConfigMigrationLoading(false);
    }
  };

  const handleSaveManifest = async () => {
    if (!manifestName) {
      message.warning('请输入Manifest名称');
      return;
    }
    try {
      const enabledCategories = manifestCategories.filter(c => c.enabled);
      const manifest = {
        templateManifest: {
          name: manifestName,
          isDefault: manifests.length === 0,
          categories: enabledCategories.map(c => ({
            name: c.name,
            label: c.label,
            source: c.source,
            paths: c.paths,
            discoveryHint: c.discoveryHint
          })),
          normalizePaths: {
            'agents.defaults.workspace': 'workspace',
            'agents.list[].workspace': 'workspace-{agentId}',
            'session.store': 'agents/{agentId}/sessions/sessions.json',
            'logging.file': 'logs/openclaw.log'
          },
          excludedDirs: ['credentials', 'logs', 'bin', 'tools', 'private_templates', 'manifests', 'snapshots', 'apply_records']
        }
      };
      const res = await fetch(`${LAUNCHER_API}/template/manifest/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest })
      });
      const data = await res.json();
      if (data.success) {
        message.success('Manifest已保存');
        fetchManifests();
      } else {
        message.error(data.error || '保存失败');
      }
    } catch (err) {
      message.error(`保存失败: ${err.message}`);
    }
  };

  const handleDeleteManifest = async (name) => {
    try {
      const res = await fetch(`${LAUNCHER_API}/template/manifest/${name}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        message.success('Manifest已删除');
        fetchManifests();
      } else {
        message.error(data.error || '删除失败');
      }
    } catch (err) {
      message.error(`删除失败: ${err.message}`);
    }
  };

  const handleViewManifest = async (name) => {
    try {
      const res = await fetch(`${LAUNCHER_API}/template/manifest/${name}`);
      const data = await res.json();
      if (data.success && data.manifest) {
        setViewManifestData(data.manifest);
        setViewManifestModalVisible(true);
      } else {
        message.error(data.error || '获取Manifest详情失败');
      }
    } catch (err) {
      message.error(`获取Manifest详情失败: ${err.message}`);
    }
  };

  const handleExportTemplate = async (manifestNameToUse) => {
    setExporting(true);
    try {
      const res = await fetch(`${LAUNCHER_API}/template/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifestName: manifestNameToUse || undefined })
      });
      const data = await res.json();
      if (data.success) {
        setEditConfig(data.config || {});
        setCurrentEnv(data.env || null);
        // fileList is an object grouped by category name, convert to flat array
        setExportFileList(Object.values(data.fileList || {}).flat());
        message.success(`模板导出成功: ${data.exportInfo?.totalFiles || 0} 个文件, ${data.exportInfo?.categories?.length || 0} 个分类`);
        setModalVisible(true);
        form.setFieldsValue({
          name: `模板-${new Date().toLocaleDateString()}`,
          category: '标准',
          description: `自动导出: ${data.exportInfo?.categories?.join(', ')}`
        });
      } else {
        message.error(data.error || '导出失败');
      }
    } catch (err) {
      message.error(`导出失败: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleVerifyTemplate = async (templateId, status) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/templates/${templateId}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        message.success(status === 'approved' ? '审核通过' : '已拒绝');
        fetchTemplates();
        setVerifyModalVisible(false);
        setVerifyingTemplate(null);
      } else {
        message.error(data.error || '操作失败');
      }
    } catch (err) {
      message.error(`操作失败: ${err.message}`);
    }
  };

  function addLog(level, msg) {
    console.log(`[${level}] ${msg}`);
  }

  const getStatusTag = (status) => {
    const map = { approved: 'success', pending: 'warning', rejected: 'error' };
    const text = { approved: '已发布', pending: '待审核', rejected: '已拒绝' };
    return <Tag color={map[status] || 'default'}>{text[status] || status}</Tag>;
  };

  const handleAdd = () => {
    setEditing(null);
    setSelectedManifestForTemplate(null);
    if (launcherConfig) {
      setEditConfig({ ...launcherConfig });
    } else {
      setEditConfig(mergeWithDefaults({}));
    }
    form.resetFields();
    setModalVisible(true);
  };

  useEffect(() => {
    if (!launcherConfig && !launcherLoading) {
      refetchLauncherConfig();
    }
  }, []);

  useEffect(() => {
    if (launcherConfig && Object.keys(editConfig).length === 0) {
      setEditConfig({ ...launcherConfig });
    }
  }, [launcherConfig]);

  const handleEdit = (t) => {
    setEditing(t);
    try {
      const config = t.config || (typeof t.config_content === 'string' ? JSON.parse(t.config_content) : (t.config_content || {}));
      setEditConfig(mergeWithDefaults(config));
      setCurrentEnv(t.env || null);
      form.setFieldsValue({
        name: t.name,
        category: t.category,
        description: t.description
      });
    } catch (e) {
      setEditConfig(mergeWithDefaults({}));
      setCurrentEnv(null);
    }
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        message.success('删除成功');
        fetchTemplates();
      } else {
        message.error(data.error || '删除失败');
      }
    } catch (err) {
      message.error(`删除失败: ${err.message}`);
    }
  };

  const handleApprove = async (t) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/templates/${t.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        message.success('审核通过');
        fetchTemplates();
      } else {
        message.error(data.error || '审核失败');
      }
    } catch (err) {
      message.error(`审核失败: ${err.message}`);
    }
  };

  const handleDistribute = async (t) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/templates/${t.id}/distribute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        message.success('发放成功');
        fetchTemplates();
      } else {
        message.error(data.error || '发放失败');
      }
    } catch (err) {
      message.error(`发放失败: ${err.message}`);
    }
  };

  const handleImport = async (file) => {
    try {
      const text = await file.text();
      const rawConfig = JSON.parse(text);
      const config = mergeWithDefaults(rawConfig);
      setEditConfig(config);
      message.success('配置文件已加载');
    } catch (err) {
      message.error(`解析配置文件失败: ${err.message}`);
    }
    return false;
  };

  const handlePasteConfig = () => {
    try {
      const rawConfig = JSON.parse(pasteContent);
      const config = mergeWithDefaults(rawConfig);
      setEditConfig(config);
      setPasteModalVisible(false);
      setPasteContent('');
      message.success('配置已解析并加载');
    } catch (err) {
      message.error(`解析配置失败: ${err.message}`);
    }
  };

  const handleLoadServerConfig = async () => {
    setServerConfigLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/config/server`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        const config = mergeWithDefaults(data.data);
        setEditConfig(config);
        setCurrentEnv(null);
        message.success('服务器配置已加载');
      } else {
        message.warning(data.message || '服务器配置文件不存在');
      }
    } catch (err) {
      message.error(`加载服务器配置失败: ${err.message}`);
    } finally {
      setServerConfigLoading(false);
    }
  };

  const handleLoadLauncherConfig = async () => {
    setLauncherConfigLoading(true);
    try {
      const res = await fetch(`${LAUNCHER_API}/config/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifestName: selectedManifestForTemplate || undefined })
      });
      const data = await res.json();
      if (data.success && data.config) {
        const config = mergeWithDefaults(data.config);
        setEditConfig(config);
        setCurrentEnv(data.env || null);
        setExportFileList(Object.keys(data.fileContents || {}));
        const sourceInfo = data.manifestName ? `Manifest[${data.manifestName}]` : '默认';
        message.success(`本地配置已加载（${sourceInfo}，${Object.keys(data.fileContents || {}).length}个文件）`);
      } else {
        message.warning(data.message || '本地配置文件不存在');
      }
    } catch (err) {
      message.error(`加载本地配置失败: ${err.message}`);
    } finally {
      setLauncherConfigLoading(false);
    }
  };

  const handleConfigChange = (section, newSectionConfig) => {
    setEditConfig(prev => ({
      ...prev,
      [section]: newSectionConfig
    }));
  };

  const handleSave = async () => {
      try {
        const values = await form.validateFields();
        const token = localStorage.getItem('token');
  
        // Step 1: Get complete config from launcher, including fileContents
        const launcherExportRes = await fetch(`${LAUNCHER_API}/config/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manifestName: selectedManifestForTemplate || undefined })
        });
        const launcherExportData = await launcherExportRes.json();
  
        if (!launcherExportData.success) {
          message.error(launcherExportData.error || '无法获取本地配置进行保存');
          return;
        }

        const cleanFileContentsPaths = (fileContents) => {
          if (!fileContents) return null;
          const cleaned = {};
          for (const path in fileContents) {
            if (Object.prototype.hasOwnProperty.call(fileContents, path)) {
              // Remove drive letter or leading slash if present
              const cleanedPath = path.replace(/^[a-zA-Z]:(\\|\/)/, '').replace(/^\//, '');
              cleaned[cleanedPath] = fileContents[path];
            }
          }
          return cleaned;
        };

        const cleanedFileContents = cleanFileContentsPaths(launcherExportData.fileContents);

        const cleanObj = (obj) => {
          if (obj === undefined) return null;
          if (obj === null) return null;
          if (Array.isArray(obj)) {
            return obj.map(item => cleanObj(item)).filter(item => item !== undefined);
          }
          if (typeof obj === 'object') {
            const result = {};
            for (const [key, val] of Object.entries(obj)) {
              if (val !== undefined) {
                result[key] = cleanObj(val);
              } else {
                result[key] = null;
              }
            }
            return result;
          }
          if (typeof obj === 'number' && isNaN(obj)) return null;
          if (obj === Infinity) return null;
          if (typeof obj === 'function' || typeof obj === 'symbol') return null;
          return obj;
        };
  
        const payload = {
          name: values.name,
          description: values.description || '',
          config: JSON.stringify(cleanObj(editConfig)),
          env: currentEnv ? JSON.stringify(cleanObj(currentEnv)) : null,
          filePayload: cleanedFileContents ? JSON.stringify(cleanedFileContents) : null,
          manifest: selectedManifestForTemplate ? (async () => {
            const manifestRes = await fetch(`${LAUNCHER_API}/template/manifest/${encodeURIComponent(selectedManifestForTemplate)}`);
            const manifestData = await manifestRes.json();
            if (manifestData.success && manifestData.manifest) {
              return JSON.stringify(manifestData.manifest);
            }
            return JSON.stringify({ name: selectedManifestForTemplate });
          })() : null
        };

        const manifestToSave = await payload.manifest;
        const finalPayload = {
          ...payload,
          manifest: manifestToSave
        };
  
        const method = editing ? 'PUT' : 'POST';
        const url = editing ? `${API_BASE}/api/templates/${editing.id}` : `${API_BASE}/api/templates`;
  
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(finalPayload)
        });
        const data = await res.json();

      if (data.success) {
        message.success(editing ? '更新成功' : '创建成功');
        setModalVisible(false);
        fetchTemplates();
      } else {
        message.error(data.error || '操作失败');
      }
    } catch (err) {
      console.error('保存失败:', err);
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(editConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('配置已导出');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(editConfig, null, 2));
    message.success('配置已复制到剪贴板');
  };

  const columns = [
    { 
      title: 'ID', 
      dataIndex: 'id', 
      width: 60 
    },
    { 
      title: '名称', 
      dataIndex: 'name',
      ellipsis: true
    },
    { 
      title: '描述', 
      dataIndex: 'description', 
      ellipsis: true,
      render: (v) => v || '-'
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      width: 100, 
      render: getStatusTag 
    },
    { 
      title: '使用次数', 
      dataIndex: 'used_count', 
      width: 100, 
      render: (v) => v || 0 
    },
    { 
      title: '创建时间', 
      dataIndex: 'created_at', 
      width: 120, 
      render: (v) => v ? new Date(v).toLocaleDateString() : '-' 
    },
    {
      title: '操作',
      width: 280,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          {r.status === 'pending' && (
            <Button size="small" type="primary" onClick={() => { setVerifyingTemplate(r); setVerifyModalVisible(true); }}>审核</Button>
          )}
          {r.status === 'approved' && (
            <Button size="small" icon={<SendOutlined />} onClick={() => handleDistribute(r)}>发放</Button>
          )}
          <Button size="small" icon={<CodeOutlined />} onClick={() => fetchConfigMigration(r.id)}>Migration</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={2}>模板配置及发放</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchTemplates(); fetchManifests(); }}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建模板</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic 
              title="总模板数" 
              value={templates.length}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic 
              title="已发布" 
              value={templates.filter(t => t.status === 'approved').length}
              valueStyle={{ color: '#52c41a' }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic 
              title="待审核" 
              value={templates.filter(t => t.status === 'pending').length}
              valueStyle={{ color: '#faad14' }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic 
              title="总使用次数" 
              value={templates.reduce((sum, t) => sum + (t.used_count || 0), 0)}
              suffix="次"
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          dataSource={templates}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          loading={loading}
        />
      </Card>

      <Modal
        title={editing ? '编辑模板' : '新建模板'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>取消</Button>,
          <Button key="save" type="primary" onClick={handleSave}>保存</Button>
        ]}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="模板名称" name="name" rules={[{ required: true, message: '请输入模板名称' }]}>
                <Input placeholder="请输入模板名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="描述" name="description">
                <Input placeholder="模板描述（可选）" />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Divider />

        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Text strong>配置内容</Text>
            <Select
              placeholder="选择Manifest（可选）"
              allowClear
              value={selectedManifestForTemplate}
              onChange={(val) => setSelectedManifestForTemplate(val)}
              style={{ width: 220 }}
              options={manifests.map(m => ({ label: m.name, value: m.name }))}
            />
          </Space>
          <Button
            icon={<CloudDownloadOutlined />}
            onClick={handleLoadLauncherConfig}
            loading={launcherConfigLoading}
          >
            读取本地配置
          </Button>
          {exportFileList.length > 0 && (
            <Button
              icon={<SearchOutlined />}
              onClick={() => setShowFileListModal(true)}
            >
              查看文件列表 ({exportFileList.length})
            </Button>
          )}
        </div>

        <QuickSettings
          config={editConfig}
          onConfigChange={handleConfigChange}
        />
      </Modal>

      <Modal
        title="粘贴配置"
        open={pasteModalVisible}
        onCancel={() => {
          setPasteModalVisible(false);
          setPasteContent('');
        }}
        onOk={handlePasteConfig}
        width={600}
      >
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">
            粘贴 OpenClaw 配置内容（JSON 格式），系统会自动补全缺失的默认字段
          </Text>
        </div>
        <TextArea
          value={pasteContent}
          onChange={(e) => setPasteContent(e.target.value)}
          placeholder={`示例：
{
  "launcher": {
    "autoStart": false,
    "checkUpdate": true,
    "logLevel": "info"
  },
  "gateway": {
    "enabled": true,
    "port": 19000
  }
}`}
          rows={15}
          style={{ fontFamily: 'monospace' }}
        />
      </Modal>

      <Card
        style={{ marginTop: 16, borderColor: '#722ed1' }}
        title={
          <Space>
            <SearchOutlined />
            <Text>Manifest 管理</Text>
            <Tag color="purple">{manifests.length}个</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button size="small" icon={<SearchOutlined />} onClick={handleDiscover} loading={discovering}>
              动态发现
            </Button>
          </Space>
        }
      >
        {manifests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Text type="secondary">暂无已保存的Manifest，点击"动态发现"创建</Text>
          </div>
        ) : (
          <div>
            {manifests.map(m => (
              <Card
                key={m.name}
                size="small"
                style={{ marginBottom: 8, borderColor: m.isDefault ? '#722ed1' : '#d9d9d9' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>{m.name}</Text>
                    {m.isDefault && <Tag color="purple" style={{ marginLeft: 8 }}>默认</Tag>}
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {m.categoryCount} 个分类 | 保存于 {new Date(m.savedAt).toLocaleString()}
                    </Text>
                  </div>
                  <Space>
                    <Button size="small" icon={<SearchOutlined />} onClick={() => handleViewManifest(m.name)}>
                      查看分类
                    </Button>
                    <Button size="small" icon={<ExportOutlined />} onClick={() => handleExportTemplate(m.name)}>
                      导出
                    </Button>
                    <Popconfirm title="确定删除？" onConfirm={() => handleDeleteManifest(m.name)}>
                      <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                    </Popconfirm>
                  </Space>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Modal
        title="动态发现 - 分类扫描"
        open={discoverModalVisible}
        onCancel={() => setDiscoverModalVisible(false)}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setDiscoverModalVisible(false)}>关闭</Button>,
          <Button key="save" type="primary" icon={<SaveOutlined />} onClick={handleSaveManifest}>
            保存为Manifest
          </Button>
        ]}
      >
        {discovering ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <Paragraph style={{ marginTop: 16 }}>正在扫描本地目录...</Paragraph>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Manifest 名称：</Text>
              <Input
                value={manifestName}
                onChange={(e) => setManifestName(e.target.value)}
                placeholder="输入Manifest名称"
                style={{ width: 200, marginLeft: 8 }}
              />
            </div>
            <Divider style={{ margin: '12px 0' }}>发现的分类 ({manifestCategories.length})</Divider>
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              {manifestCategories.map((cat, idx) => (
                <Card
                  key={cat.name}
                  size="small"
                  style={{
                    marginBottom: 8,
                    borderColor: cat.enabled ? '#722ed1' : '#d9d9d9',
                    background: cat.enabled ? '#f9f0ff' : '#fafafa'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Checkbox
                        checked={cat.enabled}
                        onChange={(e) => {
                          const newCats = [...manifestCategories];
                          newCats[idx] = { ...newCats[idx], enabled: e.target.checked };
                          setManifestCategories(newCats);
                        }}
                      />
                      <div>
                        <Text strong>{cat.label || cat.name}</Text>
                        {cat.source === 'discovered' && <Tag color="blue" style={{ marginLeft: 4 }}>自动发现</Tag>}
                        {cat.source === 'preset' && <Tag color="orange" style={{ marginLeft: 4 }}>预设</Tag>}
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          路径: {cat.paths?.join(', ')}
                          {cat.discoveryHint && ` | 来源: ${cat.discoveryHint}`}
                        </Text>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </Modal>

      <Modal
        title="模板审核"
        open={verifyModalVisible}
        onCancel={() => { setVerifyModalVisible(false); setVerifyingTemplate(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setVerifyModalVisible(false); setVerifyingTemplate(null); }}>取消</Button>,
          <Button key="reject" danger icon={<CloseOutlined />} onClick={() => verifyingTemplate && handleVerifyTemplate(verifyingTemplate.id, 'rejected')}>
            拒绝
          </Button>,
          <Button key="approve" type="primary" icon={<CheckOutlined />} onClick={() => verifyingTemplate && handleVerifyTemplate(verifyingTemplate.id, 'approved')}>
            通过
          </Button>
        ]}
      >
        {verifyingTemplate && (
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="模板名称">{verifyingTemplate.name}</Descriptions.Item>
              <Descriptions.Item label="描述">{verifyingTemplate.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="分类">{verifyingTemplate.category || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{new Date(verifyingTemplate.created_at).toLocaleString()}</Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>

      <Modal
        title={`分类详情 - ${viewManifestData?.templateManifest?.name || ''}`}
        open={viewManifestModalVisible}
        onCancel={() => { setViewManifestModalVisible(false); setViewManifestData(null); }}
        footer={[
          <Button key="close" type="primary" onClick={() => { setViewManifestModalVisible(false); setViewManifestData(null); }}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {viewManifestData?.templateManifest?.categories && (
          <div>
            <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
              共 {viewManifestData.templateManifest.categories.length} 个分类
            </Text>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {viewManifestData.templateManifest.categories.map((cat, idx) => (
                <Card key={idx} size="small" style={{ marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text strong>{cat.label || cat.name}</Text>
                      <Tag color="blue">{cat.name}</Tag>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        路径: {cat.paths?.join(', ')}
                      </Text>
                    </div>
                    {cat.discoveryHint && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          来源: {cat.discoveryHint}
                        </Text>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={`文件列表预览 (${exportFileList.length} 个文件)`}
        open={showFileListModal}
        onCancel={() => setShowFileListModal(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setShowFileListModal(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {exportFileList.map((file, idx) => (
            <div key={idx} style={{ fontSize: 12, padding: '2px 0', borderBottom: '1px solid #f0f0f0', wordBreak: 'break-all' }}>
              <Text type="secondary">{file}</Text>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        title={`配置迁移规则 - ${configMigrationData?.name || ''}`}
        open={configMigrationModalVisible}
        onCancel={() => { setConfigMigrationModalVisible(false); setConfigMigrationData(null); }}
        footer={[
          <Button key="close" type="primary" onClick={() => { setConfigMigrationModalVisible(false); setConfigMigrationData(null); }}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {configMigrationLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : configMigrationData?.configMigration ? (
          <div>
            <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
              以下规则将在应用此模板时自动执行，用于清理残留字段
            </Text>
            <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, maxHeight: 500, overflowY: 'auto', fontSize: 12 }}>
              {JSON.stringify(configMigrationData.configMigration, null, 2)}
            </pre>
            <div style={{ marginTop: 16 }}>
              <Text strong>规则说明：</Text>
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                <li><Text code>key: null</Text> — 删除指定路径的字段</li>
                <li><Text code>models.providers.*.fieldName</Text> — 遍历所有 provider，删除其 fieldName 字段</li>
                <li><Text code>removeProvidersWithoutModels</Text> — 删除缺少 models 数组的空壳 provider</li>
              </ul>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Text type="secondary">此模板暂无配置迁移规则</Text>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Statistic({ title, value, suffix, valueStyle }) {
  return (
    <div>
      <Text type="secondary" style={{ fontSize: 12 }}>{title}</Text>
      <div style={{ fontSize: 24, fontWeight: 500, ...valueStyle }}>
        {value}{suffix && <span style={{ fontSize: 14, marginLeft: 4 }}>{suffix}</span>}
      </div>
    </div>
  );
}

export default Templates;
