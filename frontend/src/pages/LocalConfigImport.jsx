import React, { useState, useEffect, useMemo } from 'react';
import { Card, Alert, Steps, Button, Space, message, Spin, Typography, List, Checkbox, Input, Divider, Collapse } from 'antd';
import { CheckCircleOutlined, FileTextOutlined, SyncOutlined, FolderOpenOutlined, FolderOutlined } from '@ant-design/icons';
import localLauncherService from '../services/localLauncherService';
import { configTemplateService } from '../services/configTemplate';

const { Step } = Steps;
const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;

const LocalConfigImport = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(true);
  const [configDir, setConfigDir] = useState(null);
  const [configFiles, setConfigFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    autoDetectAndLoad();
  }, []);

  const autoDetectAndLoad = async () => {
    setDetecting(true);
    try {
      const detectResult = await localLauncherService.detectConfig();

      if (detectResult.found && detectResult.directory) {
        setConfigDir(detectResult.directory);
        message.success(`检测到配置目录: ${detectResult.directory}`);

        const filesResult = await localLauncherService.getConfigFiles();
        if (filesResult.success && filesResult.files.length > 0) {
          setConfigFiles(filesResult.files);
          
          const defaultSelected = filesResult.files
            .filter(f => 
              f.category === '主配置' || 
              f.category === '技能配置' || 
              f.category === '工作空间配置' || 
              f.category === 'Agent配置'
            )
            .map(f => f.path);
          setSelectedFiles(defaultSelected);
          setCurrentStep(1);
        } else {
          message.warning('未找到配置文件');
          setCurrentStep(0);
        }
      } else {
        message.warning('未检测到OpenClaw配置目录，请先安装并运行OpenClaw');
        setCurrentStep(0);
      }
    } catch (err) {
      message.error('检测失败: ' + err.message);
      setCurrentStep(0);
    } finally {
      setDetecting(false);
    }
  };

  const toggleFile = (path) => {
    setSelectedFiles(prev => {
      if (prev.includes(path)) {
        return prev.filter(p => p !== path);
      }
      return [...prev, path];
    });
  };

  const selectAll = () => {
    setSelectedFiles(configFiles.map(f => f.path));
  };

  const selectNone = () => {
    setSelectedFiles([]);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const groupedFiles = useMemo(() => {
    if (!configDir || !configFiles.length) return {};
    
    const groups = {};
    
    configFiles.forEach(file => {
      const relativePath = file.path.replace(configDir, '').replace(/^[\\\/]/, '');
      const parts = relativePath.split(/[\\\/]/);
      
      let groupName = '根目录';
      let subPath = '';
      
      if (parts.length > 1) {
        const firstDir = parts[0];
        
        if (firstDir === 'skills' && parts.length > 2) {
          groupName = `skills/${parts[1]}`;
          subPath = parts.slice(2).join('/');
        } else if (firstDir === 'agents' && parts.length > 2) {
          groupName = `agents/${parts[1]}`;
          subPath = parts.slice(2).join('/');
        } else if (firstDir.startsWith('workspace') && parts.length > 2) {
          groupName = `${firstDir}/${parts[1]}`;
          subPath = parts.slice(2).join('/');
        } else {
          groupName = firstDir;
          subPath = parts.slice(1).join('/');
        }
      }
      
      if (!groups[groupName]) {
        groups[groupName] = {
          files: [],
          count: 0,
          selectedCount: 0,
          isSubGroup: groupName.includes('/')
        };
      }
      
      groups[groupName].files.push({
        ...file,
        relativePath: subPath || file.name
      });
      groups[groupName].count++;
      if (selectedFiles.includes(file.path)) {
        groups[groupName].selectedCount++;
      }
    });
    
    const orderedGroups = {};
    const priorityOrder = ['根目录', 'skills', 'agents', 'workspace'];
    
    Object.keys(groups).forEach(key => {
      if (key.startsWith('skills/')) {
        if (!orderedGroups['skills']) {
          orderedGroups['skills'] = { files: [], count: 0, selectedCount: 0, subGroups: {} };
        }
        orderedGroups['skills'].subGroups[key] = groups[key];
        orderedGroups['skills'].count += groups[key].count;
        orderedGroups['skills'].selectedCount += groups[key].selectedCount;
      } else if (key.startsWith('agents/')) {
        if (!orderedGroups['agents']) {
          orderedGroups['agents'] = { files: [], count: 0, selectedCount: 0, subGroups: {} };
        }
        orderedGroups['agents'].subGroups[key] = groups[key];
        orderedGroups['agents'].count += groups[key].count;
        orderedGroups['agents'].selectedCount += groups[key].selectedCount;
      } else if (key.startsWith('workspace')) {
        if (!orderedGroups['workspace']) {
          orderedGroups['workspace'] = { files: [], count: 0, selectedCount: 0, subGroups: {} };
        }
        orderedGroups['workspace'].subGroups[key] = groups[key];
        orderedGroups['workspace'].count += groups[key].count;
        orderedGroups['workspace'].selectedCount += groups[key].selectedCount;
      } else {
        orderedGroups[key] = groups[key];
      }
    });
    
    return orderedGroups;
  }, [configDir, configFiles, selectedFiles]);

  const toggleGroup = (groupName, subGroupName = null) => {
    if (subGroupName) {
      const subGroup = groupedFiles[groupName]?.subGroups?.[subGroupName];
      if (!subGroup) return;
      
      const allSelected = subGroup.selectedCount === subGroup.count;
      
      if (allSelected) {
        setSelectedFiles(prev => prev.filter(p => !subGroup.files.some(f => f.path === p)));
      } else {
        setSelectedFiles(prev => [...new Set([...prev, ...subGroup.files.map(f => f.path)])]);
      }
    } else {
      const group = groupedFiles[groupName];
      if (!group) return;
      
      const allFiles = group.subGroups 
        ? Object.values(group.subGroups).flatMap(sg => sg.files)
        : group.files;
      
      const allSelected = group.selectedCount === group.count;
      
      if (allSelected) {
        setSelectedFiles(prev => prev.filter(p => !allFiles.some(f => f.path === p)));
      } else {
        setSelectedFiles(prev => [...new Set([...prev, ...allFiles.map(f => f.path)])]);
      }
    }
  };

  const getGroupIcon = (groupName, isSubGroup = false) => {
    if (isSubGroup) {
      return <FolderOutlined style={{ color: '#52c41a', fontSize: 14 }} />;
    }
    if (groupName === '根目录') return <FolderOpenOutlined style={{ color: '#faad14' }} />;
    if (groupName === 'skills') return <FolderOutlined style={{ color: '#52c41a' }} />;
    if (groupName === 'agents') return <FolderOutlined style={{ color: '#1890ff' }} />;
    if (groupName.startsWith('workspace')) return <FolderOutlined style={{ color: '#722ed1' }} />;
    return <FolderOutlined />;
  };

  const getGroupLabel = (groupName) => {
    if (groupName.includes('/')) {
      const parts = groupName.split('/');
      return parts[parts.length - 1];
    }
    
    const labels = {
      '根目录': '主配置目录',
      'skills': '技能配置',
      'agents': 'Agent配置',
      'workspace': '工作空间'
    };
    return labels[groupName] || groupName;
  };

  const convertPathToPlaceholder = (pathStr, configDir) => {
    if (!pathStr || typeof pathStr !== 'string') return pathStr;
    
    if (pathStr.startsWith(configDir) || pathStr.includes('.openclaw')) {
      return pathStr.replace(configDir, '{OPENCLAW_HOME}').replace(/\\/g, '/');
    }
    
    const homeDir = configDir.replace(/[\\\/]\.openclaw[\\\/]?$/, '');
    if (pathStr.startsWith(homeDir)) {
      return pathStr.replace(homeDir, '{HOME}').replace(/\\/g, '/');
    }
    
    return pathStr;
  };

  const sanitizeConfigPaths = (config, configDir) => {
    if (!config) return config;
    
    if (typeof config === 'string') {
      return convertPathToPlaceholder(config, configDir);
    }
    
    if (Array.isArray(config)) {
      return config.map(item => sanitizeConfigPaths(item, configDir));
    }
    
    if (typeof config === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(config)) {
        const isPathKey = /path|directory|folder|location|file|log|workspace|home|dir/i.test(key);
        
        if (isPathKey && typeof value === 'string') {
          sanitized[key] = convertPathToPlaceholder(value, configDir);
        } else {
          sanitized[key] = sanitizeConfigPaths(value, configDir);
        }
      }
      return sanitized;
    }
    
    return config;
  };

  const handleImport = async () => {
    if (selectedFiles.length === 0) {
      message.warning('请至少选择一个文件');
      return;
    }

    setLoading(true);
    try {
      const files = [];
      const configs = {};
      let mainConfig = {};

      for (const path of selectedFiles) {
        const result = await localLauncherService.readConfigFile(path);
        if (result.success && result.content) {
          const file = configFiles.find(f => f.path === path);
          const relativePath = configDir ? path.replace(configDir, '').replace(/^[\\\/]/, '') : file?.name;
          
          if (file?.name === 'openclaw.json') {
            const parsed = JSON.parse(result.content);
            mainConfig = sanitizeConfigPaths(parsed, configDir);
          } else if (file?.name === 'auth-profiles.json') {
            const parsed = JSON.parse(result.content);
            configs.authProfiles = sanitizeConfigPaths(parsed, configDir);
          } else if (file?.name === 'models.json') {
            const parsed = JSON.parse(result.content);
            configs.models = sanitizeConfigPaths(parsed, configDir);
          } else {
            const pathParts = relativePath.split(/[\\\/]/);
            let group = 'root';
            let subGroup = '';
            let fileName = file?.name;
            
            if (pathParts.length > 1) {
              group = pathParts[0];
              if (pathParts.length > 2) {
                subGroup = pathParts[1];
                fileName = pathParts.slice(2).join('/');
              } else {
                fileName = pathParts[1];
              }
            }
            
            let processedContent = result.content;
            if (file?.name.endsWith('.json')) {
              try {
                const parsed = JSON.parse(result.content);
                const sanitized = sanitizeConfigPaths(parsed, configDir);
                processedContent = JSON.stringify(sanitized, null, 2);
              } catch (e) {}
            }
            
            files.push({
              type: file?.name.endsWith('.md') ? 'markdown' : 'json',
              content: processedContent,
              fileName: file?.name,
              relativePath: `{OPENCLAW_HOME}/${relativePath.replace(/\\/g, '/')}`,
              structure: {
                group,
                subGroup,
                category: file?.category
              }
            });
          }
        }
      }

      const templateData = {
        name: templateName || `本地配置 ${new Date().toLocaleDateString()}`,
        description: `从 ${configDir} 导入`,
        category: 'imported',
        status: 'draft',
        config_content: {
          meta: {
            lastTouchedAt: new Date().toISOString(),
            lastTouchedVersion: '2026.3.13',
            sourceDir: '{OPENCLAW_HOME}'
          },
          files,
          configs,
          mainConfig
        }
      };

      const result = await configTemplateService.createTemplate(templateData);

      if (result.success || result.id) {
        setImportResult({
          success: true,
          importedCount: selectedFiles.length,
          templateId: result.id || result.data?.id
        });
        setCurrentStep(2);
        message.success('配置导入成功！');

        if (onComplete) {
          onComplete();
        }
      } else {
        throw new Error(result.error || '保存模版失败');
      }
    } catch (err) {
      message.error('导入失败: ' + err.message);
      setImportResult({
        success: false,
        error: err.message
      });
      setCurrentStep(2);
    } finally {
      setLoading(false);
    }
  };

  const renderDetecting = () => (
    <Card>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin tip="正在自动检测OpenClaw配置..." />
      </div>
    </Card>
  );

  const renderStep0 = () => (
    <Card title="配置检测">
      <Alert
        message="未检测到OpenClaw配置"
        description={
          <div>
            <Paragraph>请确保已安装并运行过 OpenClaw</Paragraph>
            <Paragraph type="secondary">
              配置目录通常位于: <Text code>C:\Users\{'{用户名}'}\.openclaw</Text>
            </Paragraph>
          </div>
        }
        type="warning"
        showIcon
        action={
          <Button onClick={autoDetectAndLoad} loading={detecting}>
            重新检测
          </Button>
        }
      />
    </Card>
  );

  const renderStep1 = () => (
    <Card
      title={
        <Space>
          <FolderOpenOutlined />
          <span>配置目录: {configDir}</span>
        </Space>
      }
      extra={
        <Space>
          <Button size="small" onClick={selectAll}>全选</Button>
          <Button size="small" onClick={selectNone}>取消</Button>
        </Space>
      }
    >
      <Alert
        message={`找到 ${configFiles.length} 个文件，已选择 ${selectedFiles.length} 个`}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Collapse
        defaultActiveKey={Object.keys(groupedFiles)}
        style={{ marginBottom: 16 }}
      >
        {Object.entries(groupedFiles).map(([groupName, group]) => (
          <Panel
            key={groupName}
            header={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space>
                  {getGroupIcon(groupName)}
                  <Text strong>{getGroupLabel(groupName)}</Text>
                  <Text type="secondary">({group.count} 个文件)</Text>
                </Space>
                <Space onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={group.selectedCount === group.count}
                    indeterminate={group.selectedCount > 0 && group.selectedCount < group.count}
                    onChange={() => toggleGroup(groupName)}
                  >
                    {group.selectedCount}/{group.count}
                  </Checkbox>
                </Space>
              </div>
            }
          >
            {group.subGroups ? (
              <Collapse
                defaultActiveKey={Object.keys(group.subGroups)}
                style={{ border: 'none', background: 'transparent' }}
              >
                {Object.entries(group.subGroups).map(([subGroupName, subGroup]) => (
                  <Panel
                    key={subGroupName}
                    style={{ marginBottom: 8, background: '#fafafa' }}
                    header={
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Space>
                          {getGroupIcon(subGroupName, true)}
                          <Text>{getGroupLabel(subGroupName)}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>({subGroup.count} 个文件)</Text>
                        </Space>
                        <Space onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={subGroup.selectedCount === subGroup.count}
                            indeterminate={subGroup.selectedCount > 0 && subGroup.selectedCount < subGroup.count}
                            onChange={() => toggleGroup(groupName, subGroupName)}
                          >
                            {subGroup.selectedCount}/{subGroup.count}
                          </Checkbox>
                        </Space>
                      </div>
                    }
                  >
                    <List
                      size="small"
                      dataSource={subGroup.files}
                      renderItem={item => (
                        <List.Item
                          style={{ 
                            cursor: 'pointer', 
                            background: selectedFiles.includes(item.path) ? '#f6ffed' : 'transparent',
                            padding: '6px 12px'
                          }}
                          onClick={() => toggleFile(item.path)}
                        >
                          <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                            <Checkbox checked={selectedFiles.includes(item.path)} style={{ marginRight: 8 }} />
                            <FileTextOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                            <Text style={{ flex: 1 }}>{item.relativePath || item.name}</Text>
                            <Text type="secondary" style={{ marginRight: 8, fontSize: 12 }}>{formatFileSize(item.size)}</Text>
                            <Text code style={{ fontSize: 11 }}>{item.category}</Text>
                          </div>
                        </List.Item>
                      )}
                    />
                  </Panel>
                ))}
              </Collapse>
            ) : (
              <List
                size="small"
                dataSource={group.files}
                renderItem={item => (
                  <List.Item
                    style={{ 
                      cursor: 'pointer', 
                      background: selectedFiles.includes(item.path) ? '#f6ffed' : 'transparent',
                      padding: '8px 12px'
                    }}
                    onClick={() => toggleFile(item.path)}
                  >
                    <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                      <Checkbox checked={selectedFiles.includes(item.path)} style={{ marginRight: 8 }} />
                      <FileTextOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                      <Text style={{ flex: 1 }}>{item.relativePath || item.name}</Text>
                      <Text type="secondary" style={{ marginRight: 8, fontSize: 12 }}>{formatFileSize(item.size)}</Text>
                      <Text code style={{ fontSize: 11 }}>{item.category}</Text>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Panel>
        ))}
      </Collapse>

      <Divider style={{ margin: '12px 0' }} />

      <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
        <Text style={{ lineHeight: '32px', marginRight: 8 }}>模版名称:</Text>
        <Input
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder={`本地配置 ${new Date().toLocaleDateString()}`}
          style={{ flex: 1 }}
        />
      </Space.Compact>

      <Space>
        <Button
          type="primary"
          icon={<SyncOutlined />}
          onClick={handleImport}
          loading={loading}
          disabled={selectedFiles.length === 0}
        >
          导入配置 ({selectedFiles.length})
        </Button>
        <Button onClick={autoDetectAndLoad} loading={detecting}>
          重新检测
        </Button>
      </Space>
    </Card>
  );

  const renderStep2 = () => (
    <Card title="导入结果">
      {importResult?.success ? (
        <Alert
          message="配置导入成功！"
          description={
            <div>
              <Paragraph>成功导入 {importResult.importedCount} 个文件</Paragraph>
              {importResult.templateId && (
                <Paragraph type="secondary">模版ID: {importResult.templateId}</Paragraph>
              )}
            </div>
          }
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
        />
      ) : (
        <Alert
          message="导入失败"
          description={importResult?.error || '未知错误'}
          type="error"
          showIcon
        />
      )}

      <div style={{ marginTop: 16 }}>
        <Space>
          <Button type="primary" onClick={() => {
            setCurrentStep(1);
            setImportResult(null);
          }}>
            继续导入
          </Button>
          <Button onClick={autoDetectAndLoad}>
            重新检测
          </Button>
        </Space>
      </div>
    </Card>
  );

  return (
    <div>
      <Title level={4}>本地配置导入</Title>
      <Paragraph type="secondary">
        自动检测并导入本地OpenClaw配置
      </Paragraph>

      <div style={{ marginBottom: 16 }}>
        <Steps current={currentStep} size="small">
          <Step title="自动检测" />
          <Step title="选择文件" />
          <Step title="完成" />
        </Steps>
      </div>

      {detecting && currentStep === 0 && renderDetecting()}
      {!detecting && currentStep === 0 && renderStep0()}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
    </div>
  );
};

export default LocalConfigImport;
