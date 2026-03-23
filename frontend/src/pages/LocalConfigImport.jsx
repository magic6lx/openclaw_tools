import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, Alert, Steps, Descriptions, Tag, Space, message, Modal, Spin, Collapse, Divider, Checkbox, Tooltip, List } from 'antd';
import { FolderOpenOutlined, CheckCircleOutlined, WarningOutlined, FileTextOutlined, InfoCircleOutlined, CloudUploadOutlined, SettingOutlined, CopyOutlined, StopOutlined, CloseCircleOutlined, ExclamationCircleOutlined, SafetyOutlined } from '@ant-design/icons';
import localConfigService from '../services/localConfigService';

const { Step } = Steps;
const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;

const LocalConfigImport = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [directoryPath, setDirectoryPath] = useState('');
  const [detectedDirs, setDetectedDirs] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [selectedConfigs, setSelectedConfigs] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const [templateForm] = Form.useForm();
  const [isInitialized, setIsInitialized] = useState(false);

  const getFileCopyRecommendation = (fileName, directoryType, relativePath = '') => {
    const lowerFileName = fileName.toLowerCase();
    const lowerPath = relativePath.toLowerCase();
    
    if (directoryType === 'openclaw_config') {
      if (lowerFileName === 'openclaw.json') {
        return { 
          shouldCopy: true, 
          reason: '主配置文件，必须复制',
          targetPath: 'openclaw.json',
          category: '主配置'
        };
      }
      if (lowerPath.includes('agents') && lowerFileName === 'auth-profiles.json') {
        const agentName = relativePath.split(/[/\\]/).find(part => part !== 'agents' && part !== 'agent');
        return { 
          shouldCopy: true, 
          reason: 'Agent认证配置',
          targetPath: `agents/${agentName}/agent/auth-profiles.json`,
          category: 'Agent配置',
          agentName: agentName,
          fileType: 'auth-profiles'
        };
      }
      if (lowerPath.includes('sessions') && lowerFileName.endsWith('.jsonl')) {
        return { 
          shouldCopy: false, 
          reason: '会话历史（重新开始）',
          targetPath: null,
          category: '不复制'
        };
      }
      return { 
        shouldCopy: true, 
        reason: '配置文件，建议复制',
        targetPath: relativePath || fileName,
        category: '其他配置'
      };
    }
    
    if (directoryType === 'agent_config') {
      if (lowerFileName === 'auth-profiles.json') {
        const agentName = relativePath.split(/[/\\]/).find(part => part !== 'agents' && part !== 'agent');
        return { 
          shouldCopy: true, 
          reason: 'Agent认证配置',
          targetPath: `agents/${agentName}/agent/auth-profiles.json`,
          category: 'Agent配置',
          agentName: agentName,
          fileType: 'auth-profiles'
        };
      }
      return { 
        shouldCopy: true, 
        reason: 'Agent配置文件',
        targetPath: relativePath || fileName,
        category: 'Agent配置'
      };
    }
    
    if (directoryType === 'workspace_config') {
      if (lowerFileName === 'memory.md') {
        return { 
          shouldCopy: false, 
          reason: '长期记忆（重新积累）',
          targetPath: null,
          category: '不复制'
        };
      }
      if (lowerFileName === 'user.md') {
        return { 
          shouldCopy: false, 
          reason: '用户信息（重新填写）',
          targetPath: null,
          category: '不复制'
        };
      }
      if (lowerFileName === 'tools.md') {
        return { 
          shouldCopy: false, 
          reason: '环境配置（不适用）',
          targetPath: null,
          category: '不复制'
        };
      }
      if (lowerFileName === 'agents.md') {
        const pathParts = relativePath.split(/[/\\]/);
        const agentName = pathParts.find(part => part.toLowerCase().startsWith('workspace-'));
        const cleanAgentName = agentName ? agentName.replace(/^workspace-/i, '') : 'default';
        return { 
          shouldCopy: true, 
          reason: 'Agent工作指南',
          targetPath: agentName ? `workspace-${cleanAgentName}/AGENTS.md` : 'workspace/AGENTS.md',
          category: 'Agent配置',
          agentName: cleanAgentName,
          fileType: 'agents'
        };
      }
      if (lowerFileName === 'soul.md') {
        const pathParts = relativePath.split(/[/\\]/);
        const agentName = pathParts.find(part => part.toLowerCase().startsWith('workspace-'));
        const cleanAgentName = agentName ? agentName.replace(/^workspace-/i, '') : 'default';
        return { 
          shouldCopy: true, 
          reason: 'Agent核心价值观',
          targetPath: agentName ? `workspace-${cleanAgentName}/SOUL.md` : 'workspace/SOUL.md',
          category: 'Agent配置',
          agentName: cleanAgentName,
          fileType: 'soul'
        };
      }
      return { 
        shouldCopy: true, 
        reason: '工作区文件，建议复制',
        targetPath: `workspace/${fileName}`,
        category: '其他工作区'
      };
    }
    
    if (directoryType === 'skill_config') {
      const pathParts = relativePath.split(/[/\\]/);
      const skillsIndex = pathParts.findIndex(p => p.toLowerCase() === 'skills');
      
      if (skillsIndex >= 0 && skillsIndex + 1 < pathParts.length) {
        const skillName = pathParts[skillsIndex + 1];
        const fileNameInSkill = pathParts.slice(skillsIndex + 2).join('/');
        
        return {
          shouldCopy: true,
          reason: '技能文件',
          targetPath: `skills/${skillName}/${fileNameInSkill || fileName}`,
          category: '技能配置',
          skillName: skillName
        };
      }
    }
    
    return { 
      shouldCopy: true, 
      reason: '建议复制',
      targetPath: fileName,
      category: '其他'
    };
  };

  const groupFilesByAgent = (configs) => {
    console.log('=== groupFilesByAgent 调试信息 ===');
    console.log('输入的configs:', configs);
    console.log('configs数量:', configs.length);
    
    const groups = {
        '主配置': [],
        'Agent配置': {},
        '技能配置': {},
        '不复制': [],
        '其他配置': [],
        '其他工作区': [],
        '其他': []
      };
    
    configs.forEach(dirConfig => {
      console.log('处理dirConfig:', dirConfig);
      console.log('dirConfig.directoryType:', dirConfig.directoryType);
      console.log('dirConfig.files数量:', dirConfig.files.length);
      
      dirConfig.files.forEach(file => {
        const fileWithInfo = {
          ...file,
          directoryType: dirConfig.directoryType,
          directory: dirConfig.directory
        };
        
        console.log('处理file:', file.fileName, 'directoryType:', dirConfig.directoryType);
        
        // 直接根据directoryType进行分组
        if (dirConfig.directoryType === 'openclaw_config') {
          fileWithInfo.recommendation = {
            shouldCopy: true,
            reason: '主配置文件，必须复制',
            targetPath: 'openclaw.json',
            category: '主配置'
          };
          groups['主配置'].push(fileWithInfo);
        } else if (dirConfig.directoryType === 'agent_config') {
          const agentName = file.relativePath.split(/[/\\]/).find(part => part !== 'agents' && part !== 'agent');
          
          if (file.fileName === 'sessions.json') {
            fileWithInfo.recommendation = {
              shouldCopy: false,
              reason: '会话历史（重新开始）',
              targetPath: null,
              category: '不复制'
            };
          } else {
            fileWithInfo.recommendation = {
              shouldCopy: true,
              reason: 'Agent认证配置',
              targetPath: `agents/${agentName}/agent/${file.fileName}`,
              category: 'Agent配置',
              agentName: agentName
            };
          }
          
          if (!groups['Agent配置'][agentName]) {
            groups['Agent配置'][agentName] = [];
          }
          groups['Agent配置'][agentName].push(fileWithInfo);
        } else if (dirConfig.directoryType === 'workspace_config') {
          const agentName = file.relativePath.split(/[/\\]/)[0].replace(/^workspace-/i, '');
          fileWithInfo.recommendation = {
            shouldCopy: true,
            reason: file.fileName === 'AGENTS.md' ? 'Agent工作指南' : 'Agent核心价值观',
            targetPath: `workspace-${agentName}/${file.fileName}`,
            category: 'Agent配置',
            agentName: agentName
          };
          
          if (!groups['Agent配置'][agentName]) {
            groups['Agent配置'][agentName] = [];
          }
          groups['Agent配置'][agentName].push(fileWithInfo);
        } else if (dirConfig.directoryType === 'skill_config') {
          const skillName = file.relativePath.split(/[/\\]/)[1];
          fileWithInfo.recommendation = {
            shouldCopy: true,
            reason: '技能文件',
            targetPath: `skills/${skillName}/${file.fileName}`,
            category: '技能配置',
            skillName: skillName
          };
          
          if (!groups['技能配置'][skillName]) {
            groups['技能配置'][skillName] = [];
          }
          groups['技能配置'][skillName].push(fileWithInfo);
        } else {
          const recommendation = getFileCopyRecommendation(file.fileName, dirConfig.directoryType, file.relativePath || '');
          fileWithInfo.recommendation = recommendation;
          
          if (recommendation.category === 'Agent配置' && recommendation.agentName) {
            if (!groups['Agent配置'][recommendation.agentName]) {
              groups['Agent配置'][recommendation.agentName] = [];
            }
            groups['Agent配置'][recommendation.agentName].push(fileWithInfo);
          } else if (recommendation.category === '技能配置' && recommendation.skillName) {
            if (!groups['技能配置'][recommendation.skillName]) {
              groups['技能配置'][recommendation.skillName] = [];
            }
            groups['技能配置'][recommendation.skillName].push(fileWithInfo);
          } else {
            groups[recommendation.category].push(fileWithInfo);
          }
        }
      });
    });
    
    console.log('分组结果:', groups);
    console.log('主配置数量:', groups['主配置'].length);
    console.log('Agent配置数量:', Object.keys(groups['Agent配置']).length);
    console.log('技能配置数量:', Object.keys(groups['技能配置']).length);
    console.log('=== 调试信息结束 ===');
    
    return groups;
  };

  useEffect(() => {
    console.log('LocalConfigImport mounted');
    detectDirectories();
    setIsInitialized(true);
  }, []);

  const detectDirectories = async () => {
    try {
      setLoading(true);
      const response = await localConfigService.detectDirectories();
      if (response.success) {
        setDetectedDirs(response.data);
        if (response.data.workspace_directory) {
          setDirectoryPath(response.data.workspace_directory);
        }
      }
    } catch (error) {
      message.error('检测目录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDirectory = async (type) => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.directory = true;
      
      input.onchange = async (e) => {
        const files = e.target.files;
        if (files.length > 0) {
          const directory = files[0].webkitRelativePath.split('/')[0];
          const fullPath = files[0].path || directory;
          
          if (type === 'openclaw') {
            setDetectedDirs(prev => ({ ...prev, openclaw_directory: fullPath }));
          } else if (type === 'workspace') {
            setDirectoryPath(fullPath);
          }
          
          message.success(`已选择目录: ${fullPath}`);
        }
      };
      
      input.click();
    } catch (error) {
      message.error('选择目录失败，请手动输入目录路径');
    }
  };

  const handlePreview = async () => {
    if (!detectedDirs?.openclaw_directory && !directoryPath) {
      message.warning('请至少选择一个目录');
      return;
    }

    try {
      setLoading(true);
      const response = await localConfigService.previewConfig(null, detectedDirs?.openclaw_directory, directoryPath);
      if (response.success) {
        setPreviewData(response.data);
        setSelectedConfigs([]);
        setSelectedConfig(null);
        setCurrentStep(1);
      } else {
        message.error(response.message || '预览配置失败');
      }
    } catch (error) {
      message.error('预览配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (selectedConfigs.length === 0) {
      message.warning('请至少选择一个配置文件');
      return;
    }

    try {
      setLoading(true);
      const validationPromises = selectedConfigs.map(config => {
        // 使用相对路径作为标识，如果相对路径为空则使用文件名
        const displayPath = config.relativePath || config.fileName;
        return localConfigService.validateConfig(config.config, displayPath, config.filePath);
      });
      const results = await Promise.all(validationPromises);
      
      const allValid = results.every(result => result.success && result.data.valid);
      const allErrors = results.flatMap(result => 
        result.data?.errors || []
      );
      const allWarnings = results.flatMap(result => 
        result.data?.warnings || []
      );
      const allSecurity = results.flatMap(result => 
        result.data?.security || []
      );

      setValidationResult({
        valid: allValid,
        errors: allErrors,
        warnings: allWarnings,
        security: allSecurity,
        configCount: selectedConfigs.length,
        summary: {
          errorCount: allErrors.length,
          warningCount: allWarnings.length,
          securityCount: allSecurity.length,
          totalIssues: allErrors.length + allWarnings.length + allSecurity.length
        }
      });
      setCurrentStep(2);
    } catch (error) {
      message.error('验证配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      const values = await templateForm.validateFields();
      setLoading(true);

      const templateInfo = {
        name: values.name,
        description: values.description,
        category: values.category,
        version: values.version
      };

      const response = await localConfigService.createTemplate(selectedConfigs, templateInfo);
      if (response.success) {
        message.success('配置模版创建成功');
        setCurrentStep(3);
        if (onComplete) {
          onComplete();
        }
      } else {
        message.error(response.message || '创建模版失败');
      }
    } catch (error) {
      if (error.errorFields) {
        message.warning('请填写模版信息');
      } else {
        message.error('创建模版失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setImportResult(null);
    setPreviewData(null);
    setSelectedConfig(null);
    setValidationResult(null);
    templateForm.resetFields();
  };

  const renderStep1 = () => (
    <Card title="选择目录" extra={<InfoCircleOutlined />}>
      <Alert
        message="目录选择说明"
        description={
          <div>
            <p><strong>📁 OpenClaw配置目录：</strong>选择C:\Users\{'{用户名}'}\.openclaw目录，包含openclaw.json主配置文件</p>
            <p><strong>📁 项目工作空间：</strong>选择你的项目workspace目录，包含MEMORY.md、PROJECT_PLAN.md等项目文件</p>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Form layout="vertical">
        <Form.Item 
          label="OpenClaw配置目录"
          tooltip="输入OpenClaw配置目录路径，包含openclaw.json主配置文件"
        >
          <Input
            value={detectedDirs?.openclaw_directory || ''}
            onChange={(e) => setDetectedDirs(prev => ({ ...prev, openclaw_directory: e.target.value }))}
            placeholder="例如: C:\Users\Acer\.openclaw"
            prefix={<FolderOpenOutlined />}
            disabled={loading}
          />
        </Form.Item>
        {!detectedDirs?.openclaw_directory && (
          <Alert 
            message="未输入OpenClaw配置目录" 
            description="请手动输入OpenClaw配置目录路径（例如: C:\Users\Acer\.openclaw）" 
            type="warning" 
            showIcon 
            style={{ marginTop: 8, marginBottom: 8 }}
          />
        )}
        <Form.Item 
          label="项目工作空间"
          tooltip="输入你的项目workspace目录路径，包含MEMORY.md、PROJECT_PLAN.md等项目文件"
        >
          <Input
            value={directoryPath || ''}
            onChange={(e) => setDirectoryPath(e.target.value)}
            placeholder="例如: D:\Projects\project1\workspace"
            prefix={<FolderOpenOutlined />}
            disabled={loading}
          />
        </Form.Item>
        {!directoryPath && (
          <Alert 
            message="未输入项目工作空间" 
            description="请手动输入你的项目workspace目录路径（例如: D:\Projects\project1\workspace）" 
            type="warning" 
            showIcon 
            style={{ marginTop: 8, marginBottom: 8 }}
          />
        )}
        <Form.Item label="系统信息">
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="操作系统">
              {detectedDirs?.system_info?.os_type || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="平台">
              {detectedDirs?.system_info?.platform || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="架构">
              {detectedDirs?.system_info?.arch || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="主机名">
              {detectedDirs?.system_info?.hostname || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Form.Item>
        <Form.Item>
          <Space>
            <Button onClick={detectDirectories} loading={loading}>
              重新检测
            </Button>
            <Button type="primary" onClick={handlePreview} loading={loading}>
              预览配置
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );

  const renderStep2 = () => {
    if (!previewData?.configs) {
      return null;
    }

    const fileGroups = groupFilesByAgent(previewData.configs);
    const allFiles = previewData.configs.flatMap(d => d.files);

    console.log('=== 文件分组调试信息 ===');
    console.log('原始配置数据:', previewData.configs);
    console.log('文件分组结果:', fileGroups);
    console.log('主配置数量:', fileGroups['主配置'].length);
    console.log('主配置文件:', fileGroups['主配置']);
    console.log('Agent配置数量:', Object.keys(fileGroups['Agent配置']).length);
    console.log('Agent配置详情:', fileGroups['Agent配置']);
    console.log('技能配置数量:', Object.keys(fileGroups['技能配置']).length);
    console.log('技能配置详情:', fileGroups['技能配置']);
    console.log('=== 调试信息结束 ===');

    return (
      <Card title="配置预览" extra={<FileTextOutlined />}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Alert
            message="配置预览说明"
            description="按照OpenClaw配置结构分类显示，包括主配置、Agent配置和技能配置。每个Agent包含3个文件（auth-profiles.json、AGENTS.md、SOUL.md），每个技能单独显示，并标注文件应该复制的目标位置。"
            type="info"
            showIcon
          />

          <Alert
            message="智能复制建议"
            description={
              <div>
                <p><strong>✅ 建议复制：</strong>openclaw.json（主配置）、每个Agent的3个文件（auth-profiles.json、AGENTS.md、SOUL.md）、skills/*（技能文件）</p>
                <p><strong>❌ 不建议复制：</strong>workspace/MEMORY.md（长期记忆）、workspace/USER.md（用户信息）、workspace/TOOLS.md（环境配置）、agents/*/sessions/*.jsonl（会话历史）</p>
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {selectedConfigs.length > 0 && (
            <Alert
              message={`已选择 ${selectedConfigs.length} 个配置文件`}
              description="勾选的配置文件将被打包到一个模版中"
              type="success"
              showIcon
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <Space>
              <Button size="small" onClick={() => {
                setSelectedConfigs(allFiles);
                if (allFiles.length > 0) {
                  setSelectedConfig(allFiles[0].config);
                }
              }}>
                全选
              </Button>
              <Button size="small" onClick={() => {
                setSelectedConfigs([]);
                setSelectedConfig(null);
              }}>
                清空
              </Button>
              <Button size="small" type="primary" onClick={() => {
                const recommended = allFiles.filter(f => 
                  getFileCopyRecommendation(f.fileName, f.directoryType, f.relativePath).shouldCopy
                );
                setSelectedConfigs(recommended);
                if (recommended.length > 0) {
                  setSelectedConfig(recommended[0].config);
                }
              }}>
                智能选择建议文件
              </Button>
            </Space>
          </div>

          <Collapse defaultActiveKey={['主配置', 'Agent配置', '技能配置']} ghost>
            {fileGroups['主配置'].length > 0 && (
              <Panel 
                header={
                  <Space>
                    <span>📋 主配置</span>
                    <Tag color="blue">{fileGroups['主配置'].length} 个文件</Tag>
                  </Space>
                } 
                key="主配置"
              >
                <div style={{ background: '#fafafa', padding: '12px', borderRadius: '4px' }}>
                  {fileGroups['主配置'].map((file, index) => {
                    const recommendation = file.recommendation;
                    return (
                      <div key={index} style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        padding: '12px',
                        background: 'white',
                        borderRadius: '4px',
                        border: '1px solid #e8e8e8',
                        marginBottom: '8px'
                      }}>
                        <Checkbox 
                          value={file.fileName} 
                          checked={selectedConfigs.some(sc => sc.fileName === file.fileName)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedConfigs([...selectedConfigs, file]);
                              if (!selectedConfig) {
                                setSelectedConfig(file.config);
                              }
                            } else {
                              setSelectedConfigs(selectedConfigs.filter(sc => sc.fileName !== file.fileName));
                              if (selectedConfig?.fileName === file.fileName) {
                                setSelectedConfig(selectedConfigs.length > 1 ? selectedConfigs[0].config : null);
                              }
                            }
                          }}
                          style={{ marginRight: '12px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 500, marginRight: '8px' }}>{file.fileName}</span>
                            {file.fileSizeStr && (
                              <Tag color="blue" style={{ marginLeft: '8px', fontSize: '11px' }}>
                                {file.fileSizeStr}
                              </Tag>
                            )}
                            {recommendation.shouldCopy ? (
                              <Tooltip title={recommendation.reason}>
                                <Tag color="success" icon={<CopyOutlined />}>建议复制</Tag>
                              </Tooltip>
                            ) : (
                              <Tooltip title={recommendation.reason}>
                                <Tag color="warning" icon={<StopOutlined />}>不建议复制</Tag>
                              </Tooltip>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#999' }}>
                            <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
                              <span>{recommendation.reason}</span>
                              <span>目标位置: <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '3px' }}>{recommendation.targetPath}</code></span>
                            </Space>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}

            {Object.keys(fileGroups['Agent配置']).length > 0 && (
              <Panel 
                header={
                  <Space>
                    <span>🤖 Agent配置</span>
                    <Tag color="purple">{Object.keys(fileGroups['Agent配置']).length} 个Agent</Tag>
                  </Space>
                } 
                key="Agent配置"
              >
                {Object.entries(fileGroups['Agent配置']).map(([agentName, files]) => (
                  <Card 
                    key={agentName} 
                    size="small" 
                    title={
                      <Space>
                        <span>🤖 {agentName}</span>
                        <Tag color="purple">{files.length} 个文件</Tag>
                      </Space>
                    }
                    style={{ marginBottom: '12px', border: '1px solid #d9d9d9' }}
                  >
                    <div style={{ background: '#fafafa', padding: '12px', borderRadius: '4px' }}>
                      {files.map((file, index) => {
                        const recommendation = file.recommendation;
                        return (
                          <div key={index} style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            padding: '12px',
                            background: 'white',
                            borderRadius: '4px',
                            border: '1px solid #e8e8e8',
                            marginBottom: '8px'
                          }}>
                            <Checkbox 
                              value={file.fileName} 
                              checked={selectedConfigs.some(sc => sc.fileName === file.fileName)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedConfigs([...selectedConfigs, file]);
                                  if (!selectedConfig) {
                                    setSelectedConfig(file.config);
                                  }
                                } else {
                                  setSelectedConfigs(selectedConfigs.filter(sc => sc.fileName !== file.fileName));
                                  if (selectedConfig?.fileName === file.fileName) {
                                    setSelectedConfig(selectedConfigs.length > 1 ? selectedConfigs[0].config : null);
                                  }
                                }
                              }}
                              style={{ marginRight: '12px' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 500, marginRight: '8px' }}>{file.fileName}</span>
                                {file.fileSizeStr && (
                                  <Tag color="blue" style={{ marginLeft: '8px', fontSize: '11px' }}>
                                    {file.fileSizeStr}
                                  </Tag>
                                )}
                                {recommendation.shouldCopy ? (
                                  <Tooltip title={recommendation.reason}>
                                    <Tag color="success" icon={<CopyOutlined />}>建议复制</Tag>
                                  </Tooltip>
                                ) : (
                                  <Tooltip title={recommendation.reason}>
                                    <Tag color="warning" icon={<StopOutlined />}>不建议复制</Tag>
                                  </Tooltip>
                                )}
                              </div>
                              <div style={{ fontSize: '12px', color: '#999' }}>
                                <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
                                  <span>{recommendation.reason}</span>
                                  <span>目标位置: <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '3px' }}>{recommendation.targetPath}</code></span>
                                </Space>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </Panel>
            )}

            {Object.keys(fileGroups['技能配置']).length > 0 && (
              <Panel 
                header={
                  <Space>
                    <span>🎯 技能配置</span>
                    <Tag color="orange">{Object.keys(fileGroups['技能配置']).length} 个技能</Tag>
                  </Space>
                } 
                key="技能配置"
              >
                {Object.entries(fileGroups['技能配置']).map(([skillName, files]) => (
                  <Card 
                    key={skillName} 
                    size="small" 
                    title={
                      <Space>
                        <span>📦 {skillName}</span>
                        <Tag color="orange">{files.length} 个文件</Tag>
                      </Space>
                    }
                    style={{ marginBottom: '12px', border: '1px solid #d9d9d9' }}
                  >
                    <div style={{ background: '#fafafa', padding: '12px', borderRadius: '4px' }}>
                      {files.map((file, index) => {
                        const recommendation = file.recommendation;
                        return (
                          <div key={index} style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            padding: '12px',
                            background: 'white',
                            borderRadius: '4px',
                            border: '1px solid #e8e8e8',
                            marginBottom: '8px'
                          }}>
                            <Checkbox 
                              value={file.fileName} 
                              checked={selectedConfigs.some(sc => sc.fileName === file.fileName)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedConfigs([...selectedConfigs, file]);
                                  if (!selectedConfig) {
                                    setSelectedConfig(file.config);
                                  }
                                } else {
                                  setSelectedConfigs(selectedConfigs.filter(sc => sc.fileName !== file.fileName));
                                  if (selectedConfig?.fileName === file.fileName) {
                                    setSelectedConfig(selectedConfigs.length > 1 ? selectedConfigs[0].config : null);
                                  }
                                }
                              }}
                              style={{ marginRight: '12px' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 500, marginRight: '8px' }}>{file.fileName}</span>
                                {file.fileSizeStr && (
                                  <Tag color="blue" style={{ marginLeft: '8px', fontSize: '11px' }}>
                                    {file.fileSizeStr}
                                  </Tag>
                                )}
                                {recommendation.shouldCopy ? (
                                  <Tooltip title={recommendation.reason}>
                                    <Tag color="success" icon={<CopyOutlined />}>建议复制</Tag>
                                  </Tooltip>
                                ) : (
                                  <Tooltip title={recommendation.reason}>
                                    <Tag color="warning" icon={<StopOutlined />}>不建议复制</Tag>
                                  </Tooltip>
                                )}
                              </div>
                              <div style={{ fontSize: '12px', color: '#999' }}>
                                <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
                                  <span>{recommendation.reason}</span>
                                  <span>目标位置: <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '3px' }}>{recommendation.targetPath}</code></span>
                                </Space>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </Panel>
            )}

            {fileGroups['不复制'].length > 0 && (
              <Panel 
                header={
                  <Space>
                    <span>🚫 不建议复制的文件</span>
                    <Tag color="warning">{fileGroups['不复制'].length} 个文件</Tag>
                  </Space>
                } 
                key="不复制"
              >
                <div style={{ background: '#fafafa', padding: '12px', borderRadius: '4px' }}>
                  {fileGroups['不复制'].map((file, index) => {
                    const recommendation = file.recommendation;
                    return (
                      <div key={index} style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        padding: '12px',
                        background: 'white',
                        borderRadius: '4px',
                        border: '1px solid #e8e8e8',
                        marginBottom: '8px',
                        opacity: 0.7
                      }}>
                        <Checkbox 
                          value={file.fileName} 
                          checked={selectedConfigs.some(sc => sc.fileName === file.fileName)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedConfigs([...selectedConfigs, file]);
                              if (!selectedConfig) {
                                setSelectedConfig(file.config);
                              }
                            } else {
                              setSelectedConfigs(selectedConfigs.filter(sc => sc.fileName !== file.fileName));
                              if (selectedConfig?.fileName === file.fileName) {
                                setSelectedConfig(selectedConfigs.length > 1 ? selectedConfigs[0].config : null);
                              }
                            }
                          }}
                          style={{ marginRight: '12px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 500, marginRight: '8px' }}>{file.fileName}</span>
                            {file.fileSizeStr && (
                              <Tag color="blue" style={{ marginLeft: '8px', fontSize: '11px' }}>
                                {file.fileSizeStr}
                              </Tag>
                            )}
                            <Tooltip title={recommendation.reason}>
                              <Tag color="warning" icon={<StopOutlined />}>不建议复制</Tag>
                            </Tooltip>
                          </div>
                          <div style={{ fontSize: '12px', color: '#999' }}>
                            {recommendation.reason}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}

            {(fileGroups['其他配置'].length > 0 || fileGroups['其他工作区'].length > 0 || fileGroups['其他'].length > 0) && (
              <Panel 
                header={
                  <Space>
                    <span>📄 其他文件</span>
                    <Tag color="default">{fileGroups['其他配置'].length + fileGroups['其他工作区'].length + fileGroups['其他'].length} 个文件</Tag>
                  </Space>
                } 
                key="其他"
              >
                <div style={{ background: '#fafafa', padding: '12px', borderRadius: '4px' }}>
                  {[...fileGroups['其他配置'], ...fileGroups['其他工作区'], ...fileGroups['其他']].map((file, index) => {
                    const recommendation = file.recommendation;
                    return (
                      <div key={index} style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        padding: '12px',
                        background: 'white',
                        borderRadius: '4px',
                        border: '1px solid #e8e8e8',
                        marginBottom: '8px'
                      }}>
                        <Checkbox 
                          value={file.fileName} 
                          checked={selectedConfigs.some(sc => sc.fileName === file.fileName)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedConfigs([...selectedConfigs, file]);
                              if (!selectedConfig) {
                                setSelectedConfig(file.config);
                              }
                            } else {
                              setSelectedConfigs(selectedConfigs.filter(sc => sc.fileName !== file.fileName));
                              if (selectedConfig?.fileName === file.fileName) {
                                setSelectedConfig(selectedConfigs.length > 1 ? selectedConfigs[0].config : null);
                              }
                            }
                          }}
                          style={{ marginRight: '12px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 500, marginRight: '8px' }}>{file.fileName}</span>
                            {recommendation.shouldCopy ? (
                              <Tooltip title={recommendation.reason}>
                                <Tag color="success" icon={<CopyOutlined />}>建议复制</Tag>
                              </Tooltip>
                            ) : (
                              <Tooltip title={recommendation.reason}>
                                <Tag color="warning" icon={<StopOutlined />}>不建议复制</Tag>
                              </Tooltip>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#999' }}>
                            <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
                              <span>{recommendation.reason}</span>
                              <span>目标位置: <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '3px' }}>{recommendation.targetPath}</code></span>
                            </Space>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}
          </Collapse>

        {selectedConfig && (
          <Card size="small" title="配置详情" style={{ marginTop: '16px' }}>
            {selectedConfig.type === 'markdown' ? (
              <div>
                <p><strong>文件类型:</strong> Markdown文档</p>
                <p><strong>文件名:</strong> {selectedConfig.fileName}</p>
                <p><strong>内容预览:</strong></p>
                <pre style={{ maxHeight: '400px', overflow: 'auto', background: '#f5f5f5', padding: '8px', fontSize: '12px' }}>
                  {selectedConfig.content || '无内容'}
                </pre>
              </div>
            ) : (
              <Collapse defaultActiveKey={['1', '2', '3', '4', '5']} ghost>
                <Panel header="📊 基础信息" key="1">
                  <Descriptions size="small" column={2} bordered>
                    <Descriptions.Item label="文件名" span={1}>
                      {selectedConfig.fileName}
                    </Descriptions.Item>
                    <Descriptions.Item label="最后修改" span={1}>
                      {selectedConfig.meta?.lastTouchedAt?.split('T')[0] || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="版本" span={2}>
                      {selectedConfig.meta?.lastTouchedVersion || '-'}
                    </Descriptions.Item>
                  </Descriptions>
                </Panel>

                {selectedConfig.logging && (
                  <Panel header="📝 日志配置" key="2">
                    <Alert
                      message="日志配置说明"
                      description="控制OpenClaw的日志输出级别、文件位置和样式，影响调试和问题定位效率。"
                      type="info"
                      style={{ marginBottom: 12 }}
                    />
                    <Descriptions size="small" column={2} bordered>
                      <Descriptions.Item label="日志级别">
                        <Tag color={selectedConfig.logging.level === 'debug' ? 'red' : selectedConfig.logging.level === 'info' ? 'orange' : 'green'}>
                          {selectedConfig.logging.level || '未设置'}
                        </Tag>
                        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#999' }}>
                          ({selectedConfig.logging.level === 'debug' ? '开发调试' : selectedConfig.logging.level === 'info' ? '生产运行' : '未知'})
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="日志文件">
                        {selectedConfig.logging.file || '未设置'}
                      </Descriptions.Item>
                      <Descriptions.Item label="最大文件大小">
                        {selectedConfig.logging.maxFileBytes ? 
                          `${(selectedConfig.logging.maxFileBytes / 1024 / 1024).toFixed(2)} MB` : 
                          '未设置'}
                      </Descriptions.Item>
                      <Descriptions.Item label="控制台级别">
                        {selectedConfig.logging.consoleLevel || '未设置'}
                      </Descriptions.Item>
                      <Descriptions.Item label="控制台样式">
                        <Tag color={selectedConfig.logging.consoleStyle === 'pretty' ? 'blue' : 'default'}>
                          {selectedConfig.logging.consoleStyle || '未设置'}
                        </Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  </Panel>
                )}

                {selectedConfig.channels && selectedConfig.channels.discord && (
                  <Panel header="💬 Discord配置" key="3">
                    <Alert
                      message="Discord配置说明"
                      description="控制Discord连接、重试策略和流式输出，影响网络不稳定环境下的连接稳定性。"
                      type="info"
                      style={{ marginBottom: 12 }}
                    />
                    <Descriptions size="small" column={2} bordered>
                      <Descriptions.Item label="启用状态" span={2}>
                        <Tag color={selectedConfig.channels.discord.enabled ? 'green' : 'red'}>
                          {selectedConfig.channels.discord.enabled ? '已启用' : '未启用'}
                        </Tag>
                      </Descriptions.Item>
                      {selectedConfig.channels.discord.retry && (
                        <>
                          <Descriptions.Item label="重试次数">
                            {selectedConfig.channels.discord.retry.attempts || '-'} 次
                          </Descriptions.Item>
                          <Descriptions.Item label="重试延迟">
                            最小: {selectedConfig.channels.discord.retry.minDelayMs || '-'}ms / 
                            最大: {selectedConfig.channels.discord.retry.maxDelayMs || '-'}ms
                          </Descriptions.Item>
                          <Descriptions.Item label="抖动因子">
                            {selectedConfig.channels.discord.retry.jitter || '-'}
                          </Descriptions.Item>
                        </>
                      )}
                      {selectedConfig.channels.discord.streaming && (
                        <>
                          <Descriptions.Item label="流式输出">
                            <Tag color={selectedConfig.channels.discord.streaming === 'auto' ? 'cyan' : 'default'}>
                              {selectedConfig.channels.discord.streaming || '-'}
                            </Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="流式模式">
                            {selectedConfig.channels.discord.streamMode || '-'}
                          </Descriptions.Item>
                          <Descriptions.Item label="每条消息最大行数">
                            {selectedConfig.channels.discord.maxLinesPerMessage || '-'}
                          </Descriptions.Item>
                        </>
                      )}
                    </Descriptions>
                  </Panel>
                )}

                {selectedConfig.agents?.defaults?.memorySearch && (
                  <Panel header="🧠 记忆搜索配置" key="4">
                    <Alert
                      message="记忆搜索配置说明"
                      description="控制语义搜索功能，需要Embedding模型将文本转换为向量，支持混合搜索和自动索引。"
                      type="info"
                      style={{ marginBottom: 12 }}
                    />
                    <Descriptions size="small" column={2} bordered>
                      <Descriptions.Item label="启用状态" span={2}>
                        <Tag color={selectedConfig.agents.defaults.memorySearch.enabled ? 'green' : 'red'}>
                          {selectedConfig.agents.defaults.memorySearch.enabled ? '已启用' : '未启用'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Embedding提供商">
                        <Tag color="blue">
                          {selectedConfig.agents.defaults.memorySearch.provider || '未设置'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Embedding模型">
                        {selectedConfig.agents.defaults.memorySearch.model || '未设置'}
                      </Descriptions.Item>
                      <Descriptions.Item label="搜索源">
                        {selectedConfig.agents.defaults.memorySearch.sources?.map(s => (
                          <Tag key={s} color="purple" style={{ margin: '4px' }}>{s}</Tag>
                        )) || '-'}
                      </Descriptions.Item>
                      {selectedConfig.agents.defaults.memorySearch.chunking && (
                        <>
                          <Descriptions.Item label="分块Token数">
                            {selectedConfig.agents.defaults.memorySearch.chunking.tokens || '-'}
                          </Descriptions.Item>
                          <Descriptions.Item label="分块重叠">
                            {selectedConfig.agents.defaults.memorySearch.chunking.overlap || '-'}
                          </Descriptions.Item>
                        </>
                      )}
                      {selectedConfig.agents.defaults.memorySearch.query && (
                        <>
                          <Descriptions.Item label="最大结果数">
                            {selectedConfig.agents.defaults.memorySearch.query.maxResults || '-'}
                          </Descriptions.Item>
                          <Descriptions.Item label="最小分数">
                            {selectedConfig.agents.defaults.memorySearch.query.minScore || '-'}
                          </Descriptions.Item>
                          <Descriptions.Item label="混合搜索">
                            <Tag color={selectedConfig.agents.defaults.memorySearch.query.hybrid?.enabled ? 'green' : 'red'}>
                              {selectedConfig.agents.defaults.memorySearch.query.hybrid?.enabled ? '已启用' : '未启用'}
                            </Tag>
                          </Descriptions.Item>
                        </>
                      )}
                    </Descriptions>
                  </Panel>
                )}

                {selectedConfig.agents?.defaults?.workspace && (
                  <Panel header="📁 Workspace配置" key="5">
                    <Alert
                      message="Workspace配置说明"
                      description="控制Agent工作空间路径，支持单一项目开发和多项目隔离，使用OPENCLAW_PROFILE环境变量切换项目。"
                      type="info"
                      style={{ marginBottom: 12 }}
                    />
                    <Descriptions size="small" column={1} bordered>
                      <Descriptions.Item label="Workspace路径">
                        <Tag color="blue" style={{ fontSize: '13px' }}>
                          {selectedConfig.agents.defaults.workspace || '未设置'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="说明">
                        <span style={{ fontSize: '12px', color: '#666' }}>
                          {selectedConfig.agents.defaults.workspace.includes('{profile}') ? 
                            '🔄 支持多项目隔离，使用OPENCLAW_PROFILE环境变量切换项目' : 
                            '📌 单一项目开发，所有Agent共享同一个workspace'}
                        </span>
                      </Descriptions.Item>
                    </Descriptions>
                  </Panel>
                )}

                {selectedConfig.models && (
                  <Panel header="🤖 模型配置" key="6">
                    <Alert
                      message="模型配置说明"
                      description="控制Agent使用的AI模型提供商和默认模型，影响Agent的响应能力和成本。"
                      type="info"
                      style={{ marginBottom: 12 }}
                    />
                    <Descriptions size="small" column={1} bordered>
                      <Descriptions.Item label="默认模型">
                        <Tag color="cyan" style={{ fontSize: '14px' }}>
                          {selectedConfig.models.defaultModel || '未设置'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="模型提供商">
                        {selectedConfig.models.providers ? 
                          Object.keys(selectedConfig.models.providers).map(provider => (
                            <Tag key={provider} color="blue" style={{ margin: '4px' }}>{provider}</Tag>
                          )) : '-'}
                      </Descriptions.Item>
                    </Descriptions>
                  </Panel>
                )}

                {selectedConfig.skills && selectedConfig.skills.entries && (
                  <Panel header="🛠️ 技能配置" key="7">
                    <Alert
                      message="技能配置说明"
                      description="控制Agent可用的工具和功能权限，影响Agent的能力范围和调用策略。"
                      type="info"
                      style={{ marginBottom: 12 }}
                    />
                    <Descriptions size="small" column={1} bordered>
                      <Descriptions.Item label="技能列表">
                        <div style={{ marginTop: '8px' }}>
                          {Object.keys(selectedConfig.skills.entries).map(sk => (
                            <Tag key={sk} color={selectedConfig.skills.entries[sk].enabled ? 'orange' : 'default'} style={{ margin: '4px' }}>
                              {sk} ({selectedConfig.skills.entries[sk].enabled ? '启用' : '禁用'})
                            </Tag>
                          ))}
                        </div>
                      </Descriptions.Item>
                    </Descriptions>
                  </Panel>
                )}

                <Panel header="📄 完整JSON配置" key="8">
                  <Alert
                    message="完整配置查看"
                    description="以下是完整的JSON配置，可以直接复制使用"
                    type="info"
                    style={{ marginBottom: '12px' }}
                  />
                  <div style={{ maxHeight: '500px', overflow: 'auto', background: '#fafafa', padding: '16px', borderRadius: '4px' }}>
                    <pre style={{ margin: 0, fontSize: '12px' }}>
                      {JSON.stringify(selectedConfig, null, 2)}
                    </pre>
                  </div>
                </Panel>
              </Collapse>
            )}
          </Card>
        )}

        <Space>
          <Button onClick={() => setCurrentStep(0)}>上一步</Button>
          <Button type="primary" onClick={handleValidate} loading={loading}>
            验证配置
          </Button>
        </Space>
      </Space>
    </Card>
  );
};

  const renderStep3 = () => (
    <Card title="配置验证" extra={<CheckCircleOutlined />}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 验证结果总览 */}
        {validationResult?.summary && (
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>验证文件数: <strong>{validationResult.configCount}</strong> 个</span>
                <Space>
                  {validationResult.summary.errorCount > 0 && (
                    <Tag color="error">🔴 错误: {validationResult.summary.errorCount}</Tag>
                  )}
                  {validationResult.summary.warningCount > 0 && (
                    <Tag color="warning">⚠️ 警告: {validationResult.summary.warningCount}</Tag>
                  )}
                  {validationResult.summary.securityCount > 0 && (
                    <Tag color="purple">🔒 安全: {validationResult.summary.securityCount}</Tag>
                  )}
                  {validationResult.summary.totalIssues === 0 && (
                    <Tag color="success">✅ 全部通过</Tag>
                  )}
                </Space>
              </div>
            </Space>
          </Card>
        )}

        {/* 验证状态提示 */}
        {validationResult?.valid && validationResult.summary?.errorCount === 0 ? (
          <Alert
            message="配置验证通过"
            description="所有选中的配置文件结构正确，可以创建模版"
            type="success"
            showIcon
          />
        ) : validationResult?.valid ? (
          <Alert
            message="配置验证通过（有警告）"
            description="配置存在警告，但不影响使用，建议修复"
            type="warning"
            showIcon
          />
        ) : (
          <Alert
            message="配置验证失败"
            description="配置存在错误，请修复后重试"
            type="error"
            showIcon
          />
        )}

        {/* 错误列表 */}
        {validationResult?.errors && validationResult.errors.length > 0 && (
          <Card 
            size="small" 
            title={<><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> 🔴 错误（必须修复）</>}
            style={{ borderColor: '#ff4d4f' }}
          >
            <List
              size="small"
              dataSource={validationResult.errors}
              renderItem={(error, index) => (
                <List.Item key={index}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                      [{error.code || 'ERROR'}] {error.message}
                    </div>
                    {error.suggestion && (
                      <div style={{ color: '#666', fontSize: '12px' }}>
                        💡 建议: {error.suggestion}
                      </div>
                    )}
                    <Space>
                      {error.file && (
                        <Tag size="small" color="error">文件: {error.file}</Tag>
                      )}
                      {error.field && (
                        <Tag size="small">字段: {error.field}</Tag>
                      )}
                    </Space>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}

        {/* 警告列表 */}
        {validationResult?.warnings && validationResult.warnings.length > 0 && (
          <Card 
            size="small" 
            title={<><ExclamationCircleOutlined style={{ color: '#faad14' }} /> ⚠️ 警告（建议修复）</>}
            style={{ borderColor: '#faad14' }}
          >
            <List
              size="small"
              dataSource={validationResult.warnings}
              renderItem={(warning, index) => (
                <List.Item key={index}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ color: '#faad14' }}>
                      [{warning.code || 'WARNING'}] {warning.message}
                    </div>
                    {warning.suggestion && (
                      <div style={{ color: '#666', fontSize: '12px' }}>
                        💡 建议: {warning.suggestion}
                      </div>
                    )}
                    <Space>
                      {warning.file && (
                        <Tag size="small" color="warning">文件: {warning.file}</Tag>
                      )}
                      {warning.field && (
                        <Tag size="small" color="warning">字段: {warning.field}</Tag>
                      )}
                    </Space>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}

        {/* 安全检查列表 */}
        {validationResult?.security && validationResult.security.length > 0 && (
          <Card 
            size="small" 
            title={<><SafetyOutlined style={{ color: '#722ed1' }} /> 🔒 安全检查</>}
            style={{ borderColor: '#722ed1' }}
          >
            <List
              size="small"
              dataSource={validationResult.security}
              renderItem={(security, index) => (
                <List.Item key={index}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div style={{ color: security.level === 'error' ? '#ff4d4f' : '#722ed1' }}>
                      [{security.code || 'SECURITY'}] {security.message}
                    </div>
                    {security.suggestion && (
                      <div style={{ color: '#666', fontSize: '12px' }}>
                        🔒 建议: {security.suggestion}
                      </div>
                    )}
                    <Space>
                      {security.file && (
                        <Tag size="small" color="purple">文件: {security.file}</Tag>
                      )}
                      {security.dataType && (
                        <Tag size="small" color="purple">类型: {security.dataType}</Tag>
                      )}
                    </Space>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}

        <Form form={templateForm} layout="vertical">
          <Form.Item
            name="name"
            label="模版名称"
            rules={[{ required: true, message: '请输入模版名称' }]}
          >
            <Input placeholder="例如: 开发环境配置" />
          </Form.Item>
          <Form.Item
            name="description"
            label="模版描述"
            rules={[{ required: true, message: '请输入模版描述' }]}
          >
            <TextArea rows={3} placeholder="例如: 用于开发环境的OpenClaw配置" />
          </Form.Item>
          <Form.Item
            name="category"
            label="模版分类"
            rules={[{ required: true, message: '请选择模版分类' }]}
          >
            <Select placeholder="选择分类">
              <Option value="development">开发环境</Option>
              <Option value="production">生产环境</Option>
              <Option value="testing">测试环境</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="version"
            label="模版版本"
            rules={[{ required: true, message: '请输入模版版本' }]}
          >
            <Input placeholder="例如: 1.0.0" />
          </Form.Item>
        </Form>

        <Space>
          <Button onClick={() => setCurrentStep(1)}>上一步</Button>
          <Button type="primary" onClick={handleCreateTemplate} loading={loading} icon={<CloudUploadOutlined />}>
            创建模版
          </Button>
        </Space>
      </Space>
    </Card>
  );

  const renderStep4 = () => (
    <Card title="完成" extra={<CheckCircleOutlined />}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          message="配置模版创建成功"
          description="配置模版已成功创建，可以随时使用该模版导入配置。"
          type="success"
          showIcon
        />
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="模版名称">
            {importResult?.templateName || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="模版描述">
            {importResult?.templateDescription || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="模版分类">
            {importResult?.templateCategory || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="模版版本">
            {importResult?.templateVersion || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="配置文件数">
            {importResult?.configCount || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {importResult?.createdAt || '-'}
          </Descriptions.Item>
        </Descriptions>
        <Space>
          <Button onClick={handleReset}>重新导入</Button>
          <Button type="primary" onClick={onComplete}>完成</Button>
        </Space>
      </Space>
    </Card>
  );

  return (
    <div style={{ padding: '24px' }}>
      <Steps current={currentStep} style={{ marginBottom: '24px' }}>
        <Step title="选择目录" icon={<FolderOpenOutlined />} />
        <Step title="预览配置" icon={<FileTextOutlined />} />
        <Step title="验证配置" icon={<CheckCircleOutlined />} />
        <Step title="创建模版" icon={<CloudUploadOutlined />} />
      </Steps>

      <Spin spinning={loading && !isInitialized}>
        {currentStep === 0 && renderStep1()}
        {currentStep === 1 && renderStep2()}
        {currentStep === 2 && renderStep3()}
        {currentStep === 3 && renderStep4()}
      </Spin>
    </div>
  );
};

export default LocalConfigImport;
