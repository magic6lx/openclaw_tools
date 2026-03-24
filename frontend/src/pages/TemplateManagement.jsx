import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tag,
  Drawer,
  Descriptions,
  Popconfirm,
  Tabs,
  Tree,
  Splitter,
  Collapse,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  SendOutlined,
  FolderOpenOutlined,
  FileOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { configTemplateService } from '../services/configTemplate';
import configValidator from '../services/configValidator';
import LocalConfigImport from './LocalConfigImport';

const { Panel } = Collapse;

const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

function TemplateManagement() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewDrawerVisible, setViewDrawerVisible] = useState(false);
  const [localConfigVisible, setLocalConfigVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [form] = Form.useForm();
  
  // 文件树相关状态
  const [fileTree, setFileTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [activeTab]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const filters = activeTab !== 'all' ? { status: activeTab } : {};
      const response = await configTemplateService.getTemplates(filters);
      if (response.success) {
        setTemplates(response.data.templates);
      }
    } catch (error) {
      message.error('加载模版失败');
    } finally {
      setLoading(false);
    }
  };

  // 从filePath提取相对路径（兼容旧数据）
  const extractRelativePath = (filePath, fileName) => {
    if (!filePath) return fileName;
    
    const pathParts = filePath.split(/[\\/]/);
    const openclawIndex = pathParts.findIndex(part => part === '.openclaw');
    
    if (openclawIndex !== -1) {
      return pathParts.slice(openclawIndex).join('/');
    }
    
    return fileName;
  };

  // 确保路径在.openclaw目录下
  const ensureOpenclawPath = (relativePath, filePath) => {
    // 如果路径已经以.openclaw开头，直接返回
    if (relativePath.startsWith('.openclaw/') || relativePath === '.openclaw') {
      return relativePath;
    }
    
    // 尝试从filePath提取.openclaw路径
    if (filePath) {
      const extracted = extractRelativePath(filePath, relativePath);
      if (extracted !== relativePath) {
        return extracted;
      }
    }
    
    // 如果路径不包含目录分隔符，说明是根级别的配置文件，添加.openclaw前缀
    if (!relativePath.includes('/')) {
      return `.openclaw/${relativePath}`;
    }
    
    return relativePath;
  };

  // 构建统一的文件树
  const buildFileTree = (configContent) => {
    if (!configContent) return [];
    
    // 使用一个对象来存储整个树结构
    const treeRoot = {};
    
    // 添加配置文件到树
    const addConfigToTree = (relativePath, content, key, isJson = true) => {
      const parts = relativePath.split('/');
      let current = treeRoot;
      
      parts.forEach((part, partIndex) => {
        const isLast = partIndex === parts.length - 1;
        if (!current[part]) {
          current[part] = {
            isFile: isLast,
            fileData: isLast ? { content, key, isJson, fileName: part } : null,
            children: {}
          };
        }
        current = current[part].children;
      });
    };
    
    // 主配置
    if (configContent.mainConfig) {
      const rawPath = configContent.mainConfig.relativePath || 'openclaw.json';
      const filePath = configContent.mainConfig.filePath;
      const relativePath = ensureOpenclawPath(rawPath, filePath);
      addConfigToTree(relativePath, configContent.mainConfig, 'mainConfig');
    }
    
    // 其他配置
    if (configContent.configs) {
      Object.entries(configContent.configs).forEach(([name, content]) => {
        const rawPath = content.relativePath || `${name}.json`;
        const filePath = content.filePath;
        const relativePath = ensureOpenclawPath(rawPath, filePath);
        addConfigToTree(relativePath, content, `configs.${name}`);
      });
    }
    
    // Markdown文件
    if (configContent.files) {
      configContent.files.forEach((file, index) => {
        const rawPath = file.relativePath 
          || extractRelativePath(file.filePath, file.fileName)
          || file.fileName 
          || `file-${index}.md`;
        const relativePath = ensureOpenclawPath(rawPath, file.filePath);
        addConfigToTree(relativePath, file.content, `files.${index}`, false);
      });
    }
    
    // 转换为Ant Design Tree格式
    const convertToAntdFormat = (treeObj) => {
      return Object.entries(treeObj).map(([name, node]) => {
        if (node.isFile && node.fileData) {
          return {
            title: name,
            key: node.fileData.key,
            icon: <FileOutlined />,
            content: node.fileData.content,
            isJson: node.fileData.isJson,
            isMarkdown: !node.fileData.isJson,
            fileName: node.fileData.fileName
          };
        } else {
          return {
            title: name,
            key: `folder-${name}`,
            icon: <FolderOutlined />,
            children: convertToAntdFormat(node.children)
          };
        }
      });
    };
    
    return convertToAntdFormat(treeRoot);
  };

  // 处理文件选择
  const handleFileSelect = (selectedKeys, info) => {
    const node = info.node;
    setSelectedFile(node);
    if (node.content) {
      setFileContent(
        typeof node.content === 'object' 
          ? JSON.stringify(node.content, null, 2)
          : node.content
      );
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setEditMode(true);
    
    // 构建文件树
    const tree = buildFileTree(template.config_content);
    setFileTree(tree);
    
    // 默认选中第一个文件
    if (tree.length > 0) {
      setSelectedFile(tree[0]);
      setFileContent(
        typeof tree[0].content === 'object' 
          ? JSON.stringify(tree[0].content, null, 2)
          : tree[0].content
      );
    }
    
    // 设置基本信息
    form.setFieldsValue({
      name: template.name,
      description: template.description,
      category: template.category,
      version: template.version
    });
    
    setModalVisible(true);
  };

  // 验证当前选中的文件
  const handleValidateCurrentFile = async () => {
    if (!selectedFile) {
      message.warning('请先选择一个文件');
      return;
    }

    try {
      setLoading(true);
      
      // 解析当前文件内容
      let configToValidate;
      try {
        configToValidate = selectedFile.isJson 
          ? JSON.parse(fileContent)
          : { content: fileContent };
      } catch (e) {
        message.error('文件内容格式错误，请检查JSON格式');
        setLoading(false);
        return;
      }

      // 调用验证服务
      const fileName = selectedFile.fileName || selectedFile.title;
      const result = configValidator.validateConfig(configToValidate, fileName);
      
      if (result.success) {
        const { errors, warnings, security, summary } = result.data;
        
        if (summary.totalIssues === 0) {
          message.success('✅ 配置验证通过，未发现问题');
        } else {
          // 显示验证结果
          Modal.info({
            title: '配置验证结果',
            width: 600,
            content: (
              <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                <div style={{ marginBottom: '16px' }}>
                  <Tag color={summary.errorCount > 0 ? 'error' : 'success'}>
                    🔴 错误: {summary.errorCount}
                  </Tag>
                  <Tag color={summary.warningCount > 0 ? 'warning' : 'success'}>
                    ⚠️ 警告: {summary.warningCount}
                  </Tag>
                  <Tag color={summary.securityCount > 0 ? 'purple' : 'success'}>
                    🔒 安全: {summary.securityCount}
                  </Tag>
                </div>
                
                {errors.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ color: '#ff4d4f' }}>错误</h4>
                    {errors.map((error, idx) => (
                      <div key={idx} style={{ marginBottom: '8px', padding: '8px', background: '#fff2f0', borderRadius: '4px' }}>
                        <div><strong>{error.code}</strong>: {error.message}</div>
                        {error.suggestion && <div style={{ color: '#666', fontSize: '12px' }}>💡 {error.suggestion}</div>}
                      </div>
                    ))}
                  </div>
                )}
                
                {warnings.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ color: '#faad14' }}>警告</h4>
                    {warnings.map((warning, idx) => (
                      <div key={idx} style={{ marginBottom: '8px', padding: '8px', background: '#fffbe6', borderRadius: '4px' }}>
                        <div><strong>{warning.code}</strong>: {warning.message}</div>
                        {warning.suggestion && <div style={{ color: '#666', fontSize: '12px' }}>💡 {warning.suggestion}</div>}
                      </div>
                    ))}
                  </div>
                )}
                
                {security.length > 0 && (
                  <div>
                    <h4 style={{ color: '#722ed1' }}>安全问题</h4>
                    {security.map((sec, idx) => (
                      <div key={idx} style={{ marginBottom: '8px', padding: '8px', background: '#f9f0ff', borderRadius: '4px' }}>
                        <div><strong>{sec.code}</strong>: {sec.message}</div>
                        {sec.suggestion && <div style={{ color: '#666', fontSize: '12px' }}>💡 {sec.suggestion}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          });
        }
      } else {
        message.error('验证失败: ' + result.message);
      }
    } catch (error) {
      message.error('验证过程出错: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      let processedValues = { ...values };

      if (editingTemplate) {
        // 编辑模式：从文件树构建config_content
        const updatedConfigContent = { ...editingTemplate.config_content };
        
        // 更新当前选中的文件内容
        if (selectedFile && fileContent) {
          try {
            const parsedContent = selectedFile.isJson 
              ? JSON.parse(fileContent)
              : fileContent;
            
            if (selectedFile.key === 'mainConfig') {
              updatedConfigContent.mainConfig = parsedContent;
            } else if (selectedFile.key.startsWith('configs.')) {
              const configName = selectedFile.key.replace('configs.', '');
              updatedConfigContent.configs[configName] = parsedContent;
            } else if (selectedFile.key.startsWith('files.')) {
              const fileIndex = parseInt(selectedFile.key.replace('files.', ''));
              if (updatedConfigContent.files[fileIndex]) {
                updatedConfigContent.files[fileIndex].content = parsedContent;
              }
            }
          } catch (e) {
            message.error(`文件 "${selectedFile.title}" 格式错误，请检查JSON格式`);
            setLoading(false);
            return;
          }
        }
        
        processedValues.config_content = updatedConfigContent;
      } else {
        // 创建模式：将config_content从JSON字符串转换为对象
        if (values.config_content && typeof values.config_content === 'string') {
          try {
            processedValues.config_content = JSON.parse(values.config_content);
          } catch (e) {
            message.error('配置内容格式错误，请检查JSON格式');
            setLoading(false);
            return;
          }
        }
      }

      if (editingTemplate) {
        const response = await configTemplateService.updateTemplate(
          editingTemplate.id,
          processedValues
        );
        if (response.success) {
          message.success('模版更新成功');
        }
      } else {
        const response = await configTemplateService.createTemplate(processedValues);
        if (response.success) {
          message.success('模版创建成功');
        }
      }

      setModalVisible(false);
      loadTemplates();
    } catch (error) {
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId) => {
    try {
      const response = await configTemplateService.deleteTemplate(templateId);
      if (response.success) {
        message.success('模版已删除');
        loadTemplates();
      }
    } catch (error) {
      message.error('删除模版失败');
    }
  };

  const handleSubmitReview = async (templateId) => {
    try {
      const response = await configTemplateService.submitForReview(templateId);
      if (response.success) {
        message.success('已提交审核');
        loadTemplates();
      }
    } catch (error) {
      message.error('提交审核失败');
    }
  };

  const handleReview = async (templateId, status, comment) => {
    try {
      const response = await configTemplateService.reviewTemplate(templateId, {
        status,
        comment,
      });
      if (response.success) {
        message.success('审核完成');
        loadTemplates();
      }
    } catch (error) {
      message.error('审核失败');
    }
  };

  const handleView = (template) => {
    setSelectedTemplate(template);
    setEditMode(false);
    
    // 构建文件树
    const tree = buildFileTree(template.config_content);
    setFileTree(tree);
    
    // 默认选中第一个文件
    if (tree.length > 0) {
      setSelectedFile(tree[0]);
      setFileContent(
        typeof tree[0].content === 'object' 
          ? JSON.stringify(tree[0].content, null, 2)
          : tree[0].content
      );
    }
    
    setViewDrawerVisible(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'default',
      pending: 'processing',
      approved: 'success',
      rejected: 'error',
    };
    return colors[status] || 'default';
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {status === 'draft' ? '草稿' :
           status === 'pending' ? '待审核' :
           status === 'approved' ? '已通过' : '已拒绝'}
        </Tag>
      ),
    },
    {
      title: '作者',
      dataIndex: ['author', 'device_name'],
      key: 'author',
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
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
          {record.status === 'draft' && (
            <>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              >
                编辑
              </Button>
              <Button
                type="link"
                icon={<SendOutlined />}
                onClick={() => handleSubmitReview(record.id)}
              >
                提交
              </Button>
              <Popconfirm
                title="确认删除"
                description="确定要删除此模版吗？"
                onConfirm={() => handleDelete(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                icon={<CheckOutlined />}
                onClick={() => handleReview(record.id, 'approved', '审核通过')}
              >
                通过
              </Button>
              <Button
                type="link"
                danger
                icon={<CloseOutlined />}
                onClick={() => handleReview(record.id, 'rejected', '审核拒绝')}
              >
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="模版管理"
        extra={
          <Space>
            <Button
              icon={<FolderOpenOutlined />}
              onClick={() => setLocalConfigVisible(true)}
            >
              本地配置导入
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              创建模版
            </Button>
          </Space>
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="全部" key="all" />
          <TabPane tab="草稿" key="draft" />
          <TabPane tab="待审核" key="pending" />
          <TabPane tab="已通过" key="approved" />
          <TabPane tab="已拒绝" key="rejected" />
        </Tabs>

        <Table
          columns={columns}
          dataSource={templates}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title={editingTemplate ? '编辑模版' : '创建模版'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={1000}
        confirmLoading={loading}
      >
        {editingTemplate ? (
          // 编辑模式：新布局 - 信息在上，文件树和编辑框在下
          <div style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
            {/* 上部：基本信息 */}
            <div style={{ paddingBottom: '16px', borderBottom: '1px solid #e8e8e8', marginBottom: '16px' }}>
              <Form form={form} layout="inline">
                <Form.Item
                  label="名称"
                  name="name"
                  rules={[{ required: true, message: '请输入模版名称' }]}
                  style={{ marginRight: '16px' }}
                >
                  <Input placeholder="请输入模版名称" style={{ width: '200px' }} />
                </Form.Item>
                <Form.Item label="描述" name="description" style={{ marginRight: '16px' }}>
                  <Input placeholder="请输入模版描述" style={{ width: '250px' }} />
                </Form.Item>
                <Form.Item label="分类" name="category" style={{ marginRight: '16px' }}>
                  <Select placeholder="请选择分类" allowClear style={{ width: '120px' }}>
                    <Option value="general">通用</Option>
                    <Option value="performance">性能优化</Option>
                    <Option value="security">安全</Option>
                    <Option value="development">开发</Option>
                    <Option value="production">生产</Option>
                  </Select>
                </Form.Item>
                <Form.Item label="版本" name="version">
                  <Input placeholder="版本号" style={{ width: '100px' }} />
                </Form.Item>
              </Form>
            </div>
            
            {/* 下部：文件树和编辑框并排 */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* 左侧：文件树 */}
              <div style={{ width: '300px', paddingRight: '16px', borderRight: '1px solid #e8e8e8', overflow: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0 }}>配置文件</h4>
                  <Button 
                    type="primary" 
                    size="small"
                    onClick={handleValidateCurrentFile}
                    disabled={!selectedFile}
                  >
                    验证配置
                  </Button>
                </div>
                <Tree
                  treeData={fileTree}
                  onSelect={handleFileSelect}
                  selectedKeys={selectedFile ? [selectedFile.key] : []}
                  showIcon
                  defaultExpandAll
                />
              </div>
              
              {/* 右侧：文件内容编辑 */}
              <div style={{ flex: 1, paddingLeft: '16px', display: 'flex', flexDirection: 'column' }}>
                <h4>{selectedFile ? selectedFile.title : '请选择文件'}</h4>
                {selectedFile && (
                  <TextArea
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    rows={20}
                    style={{ flex: 1, fontFamily: 'monospace' }}
                    placeholder={selectedFile.isJson ? 'JSON格式配置内容' : '文件内容'}
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          // 创建模式：简单表单
          <Form form={form} layout="vertical">
            <Form.Item
              label="名称"
              name="name"
              rules={[{ required: true, message: '请输入模版名称' }]}
            >
              <Input placeholder="请输入模版名称" />
            </Form.Item>
            <Form.Item label="描述" name="description">
              <TextArea rows={3} placeholder="请输入模版描述" />
            </Form.Item>
            <Form.Item label="分类" name="category">
              <Select placeholder="请选择分类" allowClear>
                <Option value="general">通用</Option>
                <Option value="performance">性能优化</Option>
                <Option value="security">安全</Option>
                <Option value="development">开发</Option>
                <Option value="production">生产</Option>
              </Select>
            </Form.Item>
            <Form.Item label="配置内容" name="config_content">
              <TextArea
                rows={10}
                placeholder='请输入JSON格式的配置内容，例如: {"timeout": 30000, "max_retries": 3}'
              />
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Drawer
        title="模版详情"
        placement="right"
        width={800}
        onClose={() => setViewDrawerVisible(false)}
        open={viewDrawerVisible}
      >
        {selectedTemplate && (
          <div style={{ display: 'flex', height: '100%' }}>
            {/* 左侧：基本信息和文件树 */}
            <div style={{ width: '300px', paddingRight: '16px', borderRight: '1px solid #e8e8e8', overflow: 'auto' }}>
              <Collapse defaultActiveKey={['info', 'files']} ghost>
                <Panel header="基本信息" key="info">
                  <Descriptions bordered column={1} size="small">
                    <Descriptions.Item label="ID">{selectedTemplate.id}</Descriptions.Item>
                    <Descriptions.Item label="名称">{selectedTemplate.name}</Descriptions.Item>
                    <Descriptions.Item label="描述">
                      {selectedTemplate.description}
                    </Descriptions.Item>
                    <Descriptions.Item label="分类">
                      {selectedTemplate.category}
                    </Descriptions.Item>
                    <Descriptions.Item label="版本">
                      {selectedTemplate.version}
                    </Descriptions.Item>
                    <Descriptions.Item label="状态">
                      <Tag color={getStatusColor(selectedTemplate.status)}>
                        {selectedTemplate.status === 'draft' ? '草稿' :
                         selectedTemplate.status === 'pending' ? '待审核' :
                         selectedTemplate.status === 'approved' ? '已通过' : '已拒绝'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="作者">
                      {selectedTemplate.author?.device_name}
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                      {new Date(selectedTemplate.created_at).toLocaleString()}
                    </Descriptions.Item>
                  </Descriptions>
                </Panel>
                <Panel header="配置文件" key="files">
                  <Tree
                    treeData={fileTree}
                    onSelect={handleFileSelect}
                    selectedKeys={selectedFile ? [selectedFile.key] : []}
                    showIcon
                    defaultExpandAll
                  />
                </Panel>
              </Collapse>
            </div>
            
            {/* 右侧：文件内容查看 */}
            <div style={{ flex: 1, paddingLeft: '16px', overflow: 'auto' }}>
              <h3>{selectedFile ? selectedFile.title : '请选择文件'}</h3>
              {selectedFile && (
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 4,
                    maxHeight: 'calc(100vh - 200px)',
                    overflow: 'auto',
                    fontFamily: 'monospace',
                    fontSize: '12px'
                  }}
                >
                  {fileContent}
                </pre>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        title="从本地目录创建配置模版"
        open={localConfigVisible}
        onCancel={() => setLocalConfigVisible(false)}
        width={1000}
        footer={null}
        style={{ top: 20 }}
        destroyOnClose={true}
        maskClosable={true}
      >
        <div style={{ minHeight: '500px' }}>
          <LocalConfigImport onComplete={() => {
            setLocalConfigVisible(false);
            loadTemplates();
          }} />
        </div>
      </Modal>
    </div>
  );
}

export default TemplateManagement;