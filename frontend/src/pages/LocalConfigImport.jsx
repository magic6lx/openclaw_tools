import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Alert, Steps, Descriptions, Tag, Space, message, Spin, Typography, List, Tree, InputNumber, Switch, Divider } from 'antd';
import { FolderOpenOutlined, CheckCircleOutlined, WarningOutlined, FileTextOutlined, InfoCircleOutlined, SyncOutlined, ReloadOutlined } from '@ant-design/icons';
import openClawGatewayService from '../services/openClawGatewayService';
import clientMonitorService from '../services/clientMonitorService';

const { Step } = Steps;
const { TextArea } = Input;
const { Title, Paragraph, Text } = Typography;
const { DirectoryTree } = Tree;

const LocalConfigImport = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [directoryPath, setDirectoryPath] = useState('');
  const [detectedDirs, setDetectedDirs] = useState(null);
  const [configFiles, setConfigFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');

  useEffect(() => {
    initGateway();
  }, []);

  const initGateway = async () => {
    setConnecting(true);
    try {
      await openClawGatewayService.connect();
      setConnected(true);
      await detectDirectories();
    } catch (err) {
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  const detectDirectories = async () => {
    if (!connected) return;

    setLoading(true);
    try {
      const result = await openClawGatewayService.detectDirectories();
      setDetectedDirs(result);

      if (result.openclaw_directory) {
        setDirectoryPath(result.openclaw_directory);
      }
    } catch (err) {
      message.error('检测目录失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualPath = () => {
    const path = prompt('请输入OpenClaw配置目录路径:', directoryPath || 'C:\\Users\\.openclaw');
    if (path) {
      setDirectoryPath(path);
      setDetectedDirs(prev => ({ ...prev, openclaw_directory: path }));
    }
  };

  const handlePreview = async () => {
    if (!directoryPath) {
      message.warning('请输入目录路径');
      return;
    }

    setLoading(true);
    try {
      const result = await openClawGatewayService.importConfig(directoryPath, { preview: true });

      if (result.files) {
        setConfigFiles(result.files);
        setSelectedFiles(result.files.filter(f => f.shouldCopy).map(f => f.path));
        setCurrentStep(1);
      } else {
        message.warning('未找到配置文件');
      }
    } catch (err) {
      message.error('预览失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (selectedFiles.length === 0) {
      message.warning('请至少选择一个文件');
      return;
    }

    setLoading(true);
    try {
      const result = await openClawGatewayService.importConfig(directoryPath, {
        files: selectedFiles,
        templateName: templateName || '默认配置',
        templateDesc: templateDesc
      });

      setImportResult(result);
      setCurrentStep(2);

      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      message.error('导入失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFile = (path) => {
    setSelectedFiles(prev => {
      if (prev.includes(path)) {
        return prev.filter(p => p !== path);
      } else {
        return [...prev, path];
      }
    });
  };

  const selectAll = () => {
    setSelectedFiles(configFiles.filter(f => f.shouldCopy).map(f => f.path));
  };

  const selectNone = () => {
    setSelectedFiles([]);
  };

  const renderConnectionStatus = () => {
    if (connecting) {
      return (
        <Card>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip="正在连接OpenClaw Gateway..." />
          </div>
        </Card>
      );
    }

    if (!connected) {
      return (
        <Card>
          <Alert
            message="无法连接到OpenClaw Gateway"
            description={
              <div>
                <Paragraph>
                  请确保OpenClaw桌面应用正在运行。
                </Paragraph>
                <Paragraph type="secondary">
                  连接地址: ws://127.0.0.1:18789
                </Paragraph>
              </div>
            }
            type="error"
            showIcon
            action={
              <Button size="small" icon={<ReloadOutlined />} onClick={initGateway}>
                重试
              </Button>
            }
          />
        </Card>
      );
    }

    return null;
  };

  const renderStep0 = () => (
    <Card title="选择配置目录" extra={<Button size="small" icon={<ReloadOutlined />} onClick={detectDirectories} loading={loading}>重新检测</Button>}>
      <Alert
        message="目录选择说明"
        description={
          <div>
            <Paragraph>
              <strong>📁 OpenClaw配置目录：</strong>
              通常位于 <Text code>C:\Users\{'{用户名}'}\.openclaw</Text>，包含openclaw.json主配置文件
            </Paragraph>
            <Paragraph type="secondary">
              目录检测会自动查找常见配置位置，您也可以手动输入路径。
            </Paragraph>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {detectedDirs?.detected && (
        <Alert
          message="检测到OpenClaw配置"
          description={`目录: ${detectedDirs.openclaw_directory}`}
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Form layout="vertical">
        <Form.Item label="OpenClaw配置目录路径">
          <Space.Compact style={{ width: '100%' }}>
            <Input
              value={directoryPath}
              onChange={(e) => setDirectoryPath(e.target.value)}
              placeholder="例如: C:\Users\Acer\.openclaw"
              prefix={<FolderOpenOutlined />}
              disabled={loading}
            />
            <Button icon={<FolderOpenOutlined />} onClick={handleManualPath}>
              选择
            </Button>
          </Space.Compact>
        </Form.Item>

        <Button
          type="primary"
          icon={<FileTextOutlined />}
          onClick={handlePreview}
          loading={loading}
          disabled={!directoryPath}
        >
          预览配置
        </Button>
      </Form>
    </Card>
  );

  const renderStep1 = () => (
    <Card
      title="选择要导入的文件"
      extra={
        <Space>
          <Button size="small" onClick={selectAll}>全选</Button>
          <Button size="small" onClick={selectNone}>取消</Button>
        </Space>
      }
    >
      <Alert
        message={`找到 ${configFiles.length} 个配置文件`}
        description="选择要导入的配置文件，建议导入所有配置文件以确保完整迁移"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        {configFiles.map(file => (
          <div
            key={file.path}
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: selectedFiles.includes(file.path) ? '#f6ffed' : 'transparent'
            }}
          >
            <input
              type="checkbox"
              checked={selectedFiles.includes(file.path)}
              onChange={() => toggleFile(file.path)}
            />
            <FileTextOutlined />
            <Text style={{ flex: 1, fontSize: 12 }}>{file.path}</Text>
            {file.shouldCopy === false && (
              <Tag color="default">不复制</Tag>
            )}
            {file.category && (
              <Tag color="blue">{file.category}</Tag>
            )}
          </div>
        ))}
      </div>

      <Divider />

      <Form layout="vertical">
        <Form.Item label="配置模版名称">
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="例如: 我的配置 v1.0"
          />
        </Form.Item>
        <Form.Item label="配置描述 (可选)">
          <TextArea
            value={templateDesc}
            onChange={(e) => setTemplateDesc(e.target.value)}
            placeholder="描述这个配置的用途..."
            rows={2}
          />
        </Form.Item>
      </Form>

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
        <Button onClick={() => setCurrentStep(0)}>返回</Button>
      </Space>
    </Card>
  );

  const renderStep2 = () => (
    <Card title="导入结果">
      {importResult?.success ? (
        <>
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
          />

          <div style={{ marginTop: 16 }}>
            <Button type="primary" onClick={() => {
              setCurrentStep(0);
              setDirectoryPath('');
              setConfigFiles([]);
              setSelectedFiles([]);
              setImportResult(null);
            }}>
              继续导入
            </Button>
          </div>
        </>
      ) : (
        <Alert
          message="导入失败"
          description={importResult?.error || '未知错误'}
          type="error"
          showIcon
        />
      )}
    </Card>
  );

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>本地配置导入</Title>
      <Paragraph type="secondary">
        从本地OpenClaw配置目录导入配置文件
      </Paragraph>

      {renderConnectionStatus()}

      <div style={{ marginTop: 16 }}>
        <Steps current={currentStep} size="small">
          <Step title="选择目录" />
          <Step title="选择文件" />
          <Step title="完成" />
        </Steps>
      </div>

      <div style={{ marginTop: 16 }}>
        {currentStep === 0 && renderStep0()}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
      </div>
    </div>
  );
};

export default LocalConfigImport;