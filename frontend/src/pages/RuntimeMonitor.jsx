import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Row, Col, Statistic, Button, Space, Alert, Descriptions, Typography, message, Spin, Divider, Switch, Form, Input, InputNumber, Select, Collapse, Modal } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, DesktopOutlined, WindowsOutlined, AppleOutlined, LinuxOutlined, MobileOutlined, PlayCircleOutlined, StopOutlined, ClearOutlined, FileTextOutlined, SettingOutlined, SaveOutlined, SyncOutlined, WarningOutlined } from '@ant-design/icons';
import clientMonitorService from '../services/clientMonitorService';
import localLauncherService from '../services/localLauncherService';

const { Title, Text, Paragraph } = Typography;

const RuntimeMonitor = () => {
  const [clientInfo, setClientInfo] = useState({ data: null, loading: false, error: null });
  const [gatewayStatus, setGatewayStatus] = useState({
    launcherAvailable: false,
    gatewayRunning: false,
    loading: true,
    error: null,
    data: null
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [openclawLogs, setOpenclawLogs] = useState([]);
  const lastOpenclawLogRef = useRef(0);
  const openclawLogIntervalRef = useRef(null);
  
  const [openclawConfig, setOpenclawConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configPath, setConfigPath] = useState('');
  const [restartModalVisible, setRestartModalVisible] = useState(false);
  const [pendingConfig, setPendingConfig] = useState(null);
  const [form] = Form.useForm();
  
  const openclawLogsRef = useRef(null);

  const refreshIntervalRef = useRef(null);

  useEffect(() => {
    loadClientInfo();
    checkGatewayStatus();
    loadOpenclawConfig();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        checkGatewayStatus();
      }, 60000);
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh]);

  useEffect(() => {
    loadOpenclawLogs();
    openclawLogIntervalRef.current = setInterval(loadOpenclawLogs, 2000);

    return () => {
      if (openclawLogIntervalRef.current) {
        clearInterval(openclawLogIntervalRef.current);
      }
    };
  }, []);

  const loadOpenclawLogs = async () => {
    try {
      const result = await localLauncherService.getGatewayLogs(lastOpenclawLogRef.current);
      if (result.success && result.logs && result.logs.length > 0) {
        const parsedLogs = result.logs.map(logStr => {
          try {
            const parsed = JSON.parse(logStr);
            return {
              text: parsed.text || logStr,
              level: parsed.level || 'info',
              timestamp: parsed.timestamp
            };
          } catch {
            return { text: logStr, level: 'info' };
          }
        });
        
        if (parsedLogs.length > 0) {
          const lastLog = parsedLogs[parsedLogs.length - 1];
          if (lastLog.timestamp) {
            lastOpenclawLogRef.current = lastLog.timestamp;
          }
        }
        
        setOpenclawLogs(prev => {
          const newLogs = [...prev, ...parsedLogs];
          if (newLogs.length > 1000) {
            return newLogs.slice(-1000);
          }
          return newLogs;
        });
      }
    } catch (err) {
      console.error('Failed to load OpenClaw logs:', err);
    }
  };

  useEffect(() => {
    if (openclawLogsRef.current) {
      openclawLogsRef.current.scrollTop = openclawLogsRef.current.scrollHeight;
    }
  }, [openclawLogs]);

  const loadClientInfo = () => {
    const info = clientMonitorService.getClientSystemInfo();
    setClientInfo({ data: info, loading: false, error: null });
  };

  const checkGatewayStatus = async () => {
    setGatewayStatus(prev => ({ ...prev, loading: true }));
    try {
      const [launcherStatus, sysInfo] = await Promise.all([
        localLauncherService.checkOpenClawStatus(),
        localLauncherService.getSystemInfo()
      ]);

      setGatewayStatus({
        launcherAvailable: launcherStatus.available,
        gatewayRunning: sysInfo?.gatewayRunning || launcherStatus.gatewayRunning || false,
        loading: false,
        error: launcherStatus.available ? null : 'Launcher服务未运行',
        data: {
          version: sysInfo?.openclawVersion || launcherStatus.version,
          port: sysInfo?.gatewayPort || launcherStatus.gatewayPort,
          platform: sysInfo?.platform || launcherStatus.platform,
          installed: sysInfo?.openclawInstalled || launcherStatus.installed
        }
      });
    } catch (err) {
      setGatewayStatus(prev => ({
        ...prev,
        loading: false,
        error: '检查状态失败: ' + err.message
      }));
    }
  };

  const handleStartGateway = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      cleanupTerminal();
      initTerminal();
      setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'command', data: 'openclaw gateway run' }));
          message.success('Gateway 启动中...');
        }
      }, 2000);
    } else {
      sendCommand('openclaw gateway run');
      message.success('Gateway 启动中...');
    }
  };

  const handleStopGateway = async () => {
    setGatewayStatus(prev => ({ ...prev, loading: true }));
    try {
      const result = await localLauncherService.stopGateway();
      if (result.success) {
        message.success('Gateway 已停止');
        setTimeout(() => {
          checkGatewayStatus();
        }, 1000);
      } else {
        message.error('停止失败: ' + (result.error || '未知错误'));
        setGatewayStatus(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      message.error('停止失败: ' + err.message);
      setGatewayStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const handleStartGatewayService = async () => {
    setGatewayStatus(prev => ({ ...prev, loading: true }));
    setOpenclawLogs([]);
    lastOpenclawLogRef.current = 0;
    try {
      const result = await localLauncherService.startGatewayService();
      if (result.success) {
        let attempts = 0;
        const maxAttempts = 15;
        const checkInterval = setInterval(async () => {
          attempts++;
          const status = await localLauncherService.checkOpenClawStatus();
          if (status.gatewayRunning) {
            clearInterval(checkInterval);
            message.success('Gateway 启动成功');
            checkGatewayStatus();
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            message.error('Gateway 启动超时');
            checkGatewayStatus();
          }
        }, 2000);
      } else {
        message.error('启动失败: ' + (result.error || '未知错误'));
        setGatewayStatus(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      message.error('启动失败: ' + err.message);
      setGatewayStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const handleStopGatewayService = async () => {
    setGatewayStatus(prev => ({ ...prev, loading: true }));
    try {
      const result = await localLauncherService.stopGatewayService();
      if (result.success) {
        let attempts = 0;
        const maxAttempts = 10;
        const checkInterval = setInterval(async () => {
          attempts++;
          const status = await localLauncherService.checkOpenClawStatus();
          if (!status.gatewayRunning) {
            clearInterval(checkInterval);
            message.success('Gateway 已停止');
            checkGatewayStatus();
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            message.error('停止超时');
            checkGatewayStatus();
          }
        }, 1500);
      } else {
        message.error('停止失败: ' + (result.error || '未知错误'));
        setGatewayStatus(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      message.error('停止失败: ' + err.message);
      setGatewayStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const handleRestartGatewayService = async () => {
    setGatewayStatus(prev => ({ ...prev, loading: true }));
    try {
      await localLauncherService.stopGatewayService();
      await new Promise(resolve => setTimeout(resolve, 2000));
      const result = await localLauncherService.startGatewayService();
      if (result.success) {
        message.success('Gateway 重启中...');
      } else {
        message.error('重启失败: ' + (result.error || '未知错误'));
        setGatewayStatus(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      message.error('重启失败: ' + err.message);
      setGatewayStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const handleClearDeviceAuth = async () => {
    try {
      const result = await localLauncherService.clearDeviceAuth();
      if (result.success) {
        message.success('设备认证已清除，请刷新浏览器页面');
      } else {
        message.error('清除失败: ' + (result.error || '未知错误'));
      }
    } catch (err) {
      message.error('清除失败: ' + err.message);
    }
  };

  const handleRefreshClientInfo = () => {
    loadClientInfo();
    message.success('已刷新客户端信息');
  };

  const getOSIcon = (osName) => {
    if (!osName) return <DesktopOutlined />;
    const name = osName.toLowerCase();
    if (name.includes('windows')) return <WindowsOutlined />;
    if (name.includes('mac')) return <AppleOutlined />;
    if (name.includes('linux')) return <LinuxOutlined />;
    if (name.includes('mobile')) return <MobileOutlined />;
    return <DesktopOutlined />;
  };

  const renderClientInfo = () => {
    const info = clientInfo.data;

    return (
      <Card title="客户端系统信息" extra={<Button size="small" icon={<ReloadOutlined />} onClick={handleRefreshClientInfo}>刷新</Button>}>
        {clientInfo.error ? (
          <Alert message={clientInfo.error} type="error" showIcon />
        ) : (
          <Descriptions column={2} size="small">
            <Descriptions.Item label="设备ID">
              <Text code copyable style={{ fontSize: 11 }}>{info?.deviceId}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="设备类型">
              <Space>
                {getOSIcon(info?.osName)}
                <Text>{info?.deviceType || 'Desktop'}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="操作系统">{info?.osName}</Descriptions.Item>
            <Descriptions.Item label="浏览器">{info?.browserName} {info?.browserVersion}</Descriptions.Item>
            <Descriptions.Item label="屏幕分辨率">{info?.screenResolution}</Descriptions.Item>
            <Descriptions.Item label="语言">{info?.language}</Descriptions.Item>
            <Descriptions.Item label="时区">{info?.timezone}</Descriptions.Item>
            <Descriptions.Item label="IP地址">{info?.ipAddress || '未知'}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>
    );
  };

  const renderGatewayStatus = () => {
    const { launcherAvailable, gatewayRunning, loading, error, data } = gatewayStatus;

    return (
      <Card
        title={
          <Space>
            <span>OpenClaw Gateway 状态</span>
            {loading && <Spin size="small" />}
          </Space>
        }
        extra={
          <Space>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => checkGatewayStatus()}
              loading={loading}
            >
              刷新
            </Button>
            <Switch
              checked={autoRefresh}
              onChange={setAutoRefresh}
              checkedChildren="自动"
              unCheckedChildren="手动"
            />
          </Space>
        }
      >
        {!launcherAvailable ? (
          <Alert
            message="Launcher服务未运行"
            description="请先运行 OpenClaw Launcher 应用程序"
            type="warning"
            showIcon
            action={
              <Button size="small" onClick={checkGatewayStatus}>
                重试
              </Button>
            }
          />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Row gutter={16}>
              <Col span={5}>
                <Statistic
                  title="Gateway 状态"
                  value={gatewayRunning ? '运行中' : '已停止'}
                  valueStyle={{ color: gatewayRunning ? '#3f8600' : '#cf1322' }}
                  prefix={gatewayRunning ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                />
              </Col>
              <Col span={5}>
                <Statistic
                  title="版本"
                  value={data?.version || '未知'}
                />
              </Col>
              <Col span={4}>
                <Statistic
                  title="端口"
                  value={data?.port || 18789}
                  valueStyle={{ color: gatewayRunning ? '#3f8600' : '#999' }}
                  suffix={gatewayRunning ? '' : '(未监听)'}
                />
              </Col>
              <Col span={5}>
                <Statistic
                  title="端口状态"
                  value={gatewayRunning ? '已占用' : '空闲'}
                  valueStyle={{ color: gatewayRunning ? '#52c41a' : '#999' }}
                  prefix={gatewayRunning ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                />
              </Col>
            </Row>

            <Divider style={{ margin: '12px 0' }} />

            <Space>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleStartGatewayService}
                loading={gatewayStatus.loading}
                disabled={gatewayRunning}
              >
                启动 Gateway
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                onClick={handleStopGatewayService}
                loading={gatewayStatus.loading}
                disabled={!gatewayRunning}
              >
                停止 Gateway
              </Button>
              <Button
                icon={<SyncOutlined />}
                onClick={handleRestartGatewayService}
                loading={gatewayStatus.loading}
                disabled={!gatewayRunning}
              >
                重启 Gateway
              </Button>
              {gatewayRunning && (
                <>
                  <Button
                    type="link"
                    onClick={() => window.open('http://127.0.0.1:18789', '_blank')}
                  >
                    打开控制台 →
                  </Button>
                  <Button
                    type="link"
                    danger
                    onClick={handleClearDeviceAuth}
                  >
                    清除设备认证
                  </Button>
                </>
              )}
            </Space>
          </Space>
        )}
      </Card>
    );
  };

  const renderOpenclawLogs = () => {
    const getLogColor = (level) => {
      switch (level) {
        case 'error': return '#f5222d';
        case 'warn': return '#faad14';
        case 'success': return '#52c41a';
        default: return '#d4d4d4';
      }
    };

    return (
      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>OpenClaw 日志</span>
            <Text style={{ color: '#999', fontSize: 12 }}>(实时刷新)</Text>
          </Space>
        }
        extra={
          <Button
            size="small"
            icon={<ClearOutlined />}
            onClick={() => { setOpenclawLogs([]); lastOpenclawLogRef.current = 0; }}
          >
            清空
          </Button>
        }
      >
        <div
          ref={openclawLogsRef}
          style={{
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            padding: 12,
            borderRadius: 4,
            height: 500,
            overflow: 'auto',
            fontFamily: 'Consolas, Monaco, monospace',
            fontSize: 11,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}
        >
          {openclawLogs.length === 0 ? (
            <Text style={{ color: '#666' }}>等待日志输出...</Text>
          ) : (
            openclawLogs.map((logEntry, index) => {
              const text = typeof logEntry === 'string' ? logEntry : logEntry.text;
              const level = typeof logEntry === 'string' ? 'info' : logEntry.level;
              return (
                <div key={index} style={{ color: getLogColor(level) }}>{text}</div>
              );
            })
          )}
        </div>
      </Card>
    );
  };

  const loadOpenclawConfig = async () => {
    setConfigLoading(true);
    try {
      const result = await localLauncherService.getOpenclawConfig();
      if (result.success) {
        setOpenclawConfig(result.config);
        setConfigPath(result.path);
        
        const config = result.config || {};
        const providers = config.models?.providers || {};
        const firstProvider = Object.keys(providers)[0] || '';
        const agentDefaults = config.agents?.defaults || {};
        const logging = config.logging || {};
        
        form.setFieldsValue({
          primaryModel: agentDefaults.model?.primary || '',
          contextTokens: agentDefaults.contextTokens || 100000,
          providerName: firstProvider,
          providerBaseUrl: providers[firstProvider]?.baseUrl || '',
          providerApiKey: providers[firstProvider]?.apiKey || '',
          logLevel: logging.level || 'info',
        });
      } else {
        message.error('加载配置失败: ' + result.error);
      }
    } catch (err) {
      message.error('加载配置失败: ' + err.message);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleSaveConfig = async (values) => {
    setConfigSaving(true);
    try {
      const config = openclawConfig || {};
      const providers = config.models?.providers || {};
      const providerName = values.providerName || Object.keys(providers)[0] || 'volcengine';
      
      const newConfig = {
        ...config,
        agents: {
          ...config.agents,
          defaults: {
            ...config.agents?.defaults,
            model: {
              ...config.agents?.defaults?.model,
              primary: values.primaryModel,
            },
            contextTokens: values.contextTokens,
          },
        },
        models: {
          ...config.models,
          providers: {
            ...providers,
            [providerName]: {
              ...providers[providerName],
              baseUrl: values.providerBaseUrl,
              apiKey: values.providerApiKey,
            },
          },
        },
        logging: {
          ...config.logging,
          level: values.logLevel,
        },
      };
      
      const result = await localLauncherService.saveOpenclawConfig(newConfig);
      if (result.success) {
        message.success('配置已保存');
        setPendingConfig(newConfig);
        setRestartModalVisible(true);
      } else {
        message.error('保存配置失败: ' + result.error);
      }
    } catch (err) {
      message.error('保存配置失败: ' + err.message);
    } finally {
      setConfigSaving(false);
    }
  };

  const handleRestartGateway = async () => {
    setConfigSaving(true);
    try {
      const result = await localLauncherService.restartGateway();
      if (result.success) {
        message.success('Gateway 重启中...');
        setRestartModalVisible(false);
        setTimeout(() => {
          checkGatewayStatus();
        }, 3000);
      } else {
        message.error('重启失败: ' + result.error);
      }
    } catch (err) {
      message.error('重启失败: ' + err.message);
    } finally {
      setConfigSaving(false);
    }
  };

  const renderConfigManagement = () => {
    return (
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>关键配置管理</span>
            <Text style={{ color: '#999', fontSize: 12 }}>
              ({configPath || '未加载'})
            </Text>
          </Space>
        }
        extra={
          <Space>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={loadOpenclawConfig}
              loading={configLoading}
            >
              刷新配置
            </Button>
          </Space>
        }
      >
        {configLoading && !openclawConfig ? (
          <Spin tip="加载配置中..." />
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSaveConfig}
          >
            <Divider orientation="left">模型配置</Divider>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="提供商名称" name="providerName">
                  <Input placeholder="例如: volcengine, openai" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="API地址 (baseUrl)" name="providerBaseUrl">
                  <Input placeholder="https://api.example.com/v1" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="API密钥 (apiKey)" name="providerApiKey">
                  <Input.Password placeholder="sk-xxx..." />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="默认模型 (primary)" name="primaryModel">
                  <Input placeholder="例如: volcengine/doubao-seed-2-0-mini-260215" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="上下文Token限制" name="contextTokens">
                  <InputNumber min={1000} max={1000000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">日志配置</Divider>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="日志级别" name="logLevel">
                  <Select>
                    <Select.Option value="debug">debug - 调试</Select.Option>
                    <Select.Option value="info">info - 信息</Select.Option>
                    <Select.Option value="warn">warn - 警告</Select.Option>
                    <Select.Option value="error">error - 错误</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Collapse
              ghost
              items={[
                {
                  key: 'advanced',
                  label: '完整配置 (JSON)',
                  children: (
                    <div
                      style={{
                        backgroundColor: '#1e1e1e',
                        color: '#d4d4d4',
                        padding: 12,
                        borderRadius: 4,
                        maxHeight: 300,
                        overflow: 'auto',
                        fontFamily: 'Consolas, Monaco, monospace',
                        fontSize: 11,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {openclawConfig ? JSON.stringify(openclawConfig, null, 2) : '无配置数据'}
                    </div>
                  ),
                },
              ]}
            />

            <Divider />

            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={configSaving}
              >
                保存配置
              </Button>
              <Button
                icon={<SyncOutlined />}
                onClick={() => setRestartModalVisible(true)}
                disabled={!gatewayStatus.gatewayRunning}
              >
                重启 Gateway
              </Button>
            </Space>
          </Form>
        )}
      </Card>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>运行监控</Title>
      <Paragraph type="secondary">
        监控 OpenClaw Gateway 运行状态，管理配置文件
      </Paragraph>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          {renderGatewayStatus()}
        </Col>
        <Col span={24}>
          {renderOpenclawLogs()}
        </Col>
        <Col span={24}>
          {renderConfigManagement()}
        </Col>
        <Col span={24}>
          {renderClientInfo()}
        </Col>
      </Row>

      <Modal
        title="重启 Gateway"
        open={restartModalVisible}
        onOk={handleRestartGateway}
        onCancel={() => setRestartModalVisible(false)}
        confirmLoading={configSaving}
        okText="重启"
        cancelText="稍后手动重启"
      >
        <Alert
          message="配置已保存"
          description="建议重启 Gateway 使配置生效。是否立即重启？"
          type="info"
          showIcon
        />
      </Modal>
    </div>
  );
};

export default RuntimeMonitor;
