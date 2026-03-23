import React, { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Statistic, Progress, Table, Tag, Button, Space, Alert, Descriptions, Typography, message, Modal, Spin, Collapse, Tooltip } from 'antd';
import { ReloadOutlined, PlayCircleOutlined, StopOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningOutlined, LinkOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import runtimeMonitorService from '../services/runtimeMonitorService';

const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;

const RuntimeMonitor = () => {
  const [systemInfo, setSystemInfo] = useState({ data: null, loading: false, error: null });
  const [openclawStatus, setOpenclawStatus] = useState({ data: null, loading: false, error: null });
  const [processes, setProcesses] = useState({ data: null, loading: false, error: null });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startingOpenClaw, setStartingOpenClaw] = useState(false);
  const [openclawProgress, setOpenclawProgress] = useState([]);
  const [openclawLogs, setOpenclawLogs] = useState([]);
  const [nodeProcesses, setNodeProcesses] = useState([]);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [processDetailModal, setProcessDetailModal] = useState({ visible: false, data: null });
  const intervalRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  useEffect(() => {
    loadAllData();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(loadAllData, 5000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [autoRefresh]);

  const loadAllData = async (showProgress = false) => {
    if (isLoading) return;
    
    if (showProgress) {
      setIsRefreshing(true);
      setRefreshProgress(0);
      
      refreshIntervalRef.current = setInterval(() => {
        setRefreshProgress(prev => Math.min(prev + 10, 90));
      }, 300);
    }
    
    try {
      setIsLoading(true);
      const response = await runtimeMonitorService.getSystemStatus();
      
      const { system, openclaw, processes: processList } = response.data || {};
      
      if (response.success) {
        if (openclaw?.running) {
          await loadOpenClawLogs();
          await loadNodeProcessesDetails();
        }
        
        setSystemInfo({ 
          data: system || null, 
          loading: false, 
          error: !system ? '获取系统信息失败' : null 
        });
        
        setOpenclawStatus({ 
          data: openclaw || null, 
          loading: false, 
          error: !openclaw ? '获取OpenClaw状态失败' : null 
        });
        
        setProcesses({ 
          data: processList || [], 
          loading: false, 
          error: !processList ? '获取进程信息失败' : null 
        });

        if (openclaw?.error?.includes('进程过多')) {
          setAutoRefresh(false);
          message.warning(`检测到Node.js进程数量过多，已停止自动刷新。请手动检查并清理进程。`);
        }
      } else {
        setSystemInfo({ 
          data: system || null, 
          loading: false, 
          error: response.message || '获取系统信息失败' 
        });
        
        setOpenclawStatus({ 
          data: openclaw || null, 
          loading: false, 
          error: response.message || '获取OpenClaw状态失败' 
        });
        
        setProcesses({ 
          data: processList || [], 
          loading: false, 
          error: response.message || '获取进程信息失败' 
        });

        if (response.message?.includes('进程过多')) {
          setAutoRefresh(false);
          message.warning(`检测到Node.js进程数量过多，已停止自动刷新。请手动检查并清理进程。`);
        }
      }
    } catch (error) {
      setSystemInfo({ 
        data: null, 
        loading: false, 
        error: error.message || '获取系统信息失败' 
      });
      
      setOpenclawStatus({ 
        data: null, 
        loading: false, 
        error: error.message || '获取OpenClaw状态失败' 
      });
      
      setProcesses({ 
        data: [], 
        loading: false, 
        error: error.message || '获取进程信息失败' 
      });
    } finally {
      setIsLoading(false);
      
      if (showProgress) {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
        setRefreshProgress(100);
        
        setTimeout(() => {
          setIsRefreshing(false);
          setRefreshProgress(0);
        }, 500);
      }
    }
  };

  const loadSystemInfo = async () => {
    await loadAllData(true);
  };

  const loadOpenclawStatus = async () => {
    await loadAllData(true);
  };

  const loadProcesses = async () => {
    await loadAllData(true);
  };

  const handleRestartOpenClaw = async (action) => {
    if (!openclawStatus.data) {
      message.warning('无法获取OpenClaw状态');
      return;
    }

    const { running } = openclawStatus.data;

    if (action === 'start' && running) {
      message.warning('OpenClaw已经在运行中，无需重复启动');
      return;
    }

    if (action === 'stop' && !running) {
      message.warning('OpenClaw已经停止，无需重复停止');
      return;
    }

    Modal.confirm({
      title: '确认操作',
      content: `确定要${action === 'restart' ? '重启' : action === 'stop' ? '停止' : '启动'}OpenClaw吗？`,
      onOk: async () => {
        setStartingOpenClaw(true);
        setOpenclawProgress([]);
        
        try {
          const response = await runtimeMonitorService.restartOpenClaw(action);
          if (response.success) {
            message.success(response.message);
            if (response.progress && response.progress.length > 0) {
              setOpenclawProgress(response.progress);
            }
            
            startProgressPolling();
            await loadAllData();
          } else {
            message.error(response.message);
            setStartingOpenClaw(false);
          }
        } catch (error) {
          message.error('操作失败');
          setStartingOpenClaw(false);
        }
      }
    });
  };

  const startProgressPolling = () => {
    const pollInterval = setInterval(async () => {
      try {
        const progressResponse = await runtimeMonitorService.getOpenClawOperationProgress();
        if (progressResponse.success && progressResponse.data) {
          const operation = progressResponse.data;
          
          if (operation.progress && operation.progress.length > 0) {
            setOpenclawProgress(operation.progress);
          }
          
          if (!operation.inProgress) {
            clearInterval(pollInterval);
            setStartingOpenClaw(false);
            
            if (operation.success) {
              message.success('操作完成');
            } else if (operation.error) {
              message.error(`操作失败: ${operation.error}`);
            }
            
            await loadAllData();
          }
        }
      } catch (error) {
        console.error('获取进度失败:', error);
        clearInterval(pollInterval);
        setStartingOpenClaw(false);
      }
    }, 1000);
  };

  const loadOpenClawLogs = async () => {
    try {
      const response = await runtimeMonitorService.getOpenClawLogs(50);
      if (response.success) {
        setOpenclawLogs(response.data || []);
      }
    } catch (error) {
      console.error('加载OpenClaw日志失败:', error);
    }
  };

  const loadNodeProcessesDetails = async () => {
    try {
      const response = await runtimeMonitorService.getNodeProcessesDetails();
      if (response.success) {
        setNodeProcesses(response.data || []);
      }
    } catch (error) {
      console.error('加载Node.js进程详情失败:', error);
    }
  };

  const handleViewProcessDetails = async (pid) => {
    try {
      const response = await runtimeMonitorService.getProcessDetails(pid);
      if (response.success) {
        setProcessDetailModal({ visible: true, data: response.data });
      } else {
        message.error(response.message);
      }
    } catch (error) {
      message.error('获取进程详情失败');
    }
  };

  const renderSystemInfo = () => {
    if (systemInfo.error) {
      return (
        <Card 
          title="系统信息" 
          style={{ borderColor: '#ff4d4f' }}
          extra={
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadSystemInfo} 
              loading={systemInfo.loading}
              danger
            >
              重试
            </Button>
          }
        >
          <Alert
            message="获取系统信息失败"
            description={systemInfo.error}
            type="error"
            showIcon
            icon={<CloseCircleOutlined />}
          />
        </Card>
      );
    }

    if (!systemInfo.data) {
      return (
        <Card title="系统信息" extra={
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadSystemInfo} 
            loading={systemInfo.loading}
          >
            刷新
          </Button>
        }>
          <Spin spinning={systemInfo.loading}>
            <Alert message="正在加载系统信息..." type="info" />
          </Spin>
        </Card>
      );
    }

    const system = systemInfo.data;
    const memoryUsage = ((system.totalMemory - system.freeMemory) / system.totalMemory * 100).toFixed(2);

    return (
      <Card title="系统信息" extra={
        <Button 
          icon={<ReloadOutlined />} 
          onClick={loadSystemInfo} 
          loading={systemInfo.loading}
        >
          刷新
        </Button>
      }>
        <Spin spinning={systemInfo.loading}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="操作系统" value={`${system.platform} ${system.arch}`} />
            </Col>
            <Col span={6}>
              <Statistic title="主机名" value={system.hostname} />
            </Col>
            <Col span={6}>
              <Statistic title="运行时间" value={Math.floor(system.uptime / 3600)} suffix="小时" />
            </Col>
            <Col span={6}>
              <Statistic title="CPU核心数" value={system.cpus} />
            </Col>
          </Row>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Card size="small" title="内存使用">
                <Progress
                  percent={parseFloat(memoryUsage)}
                  status={parseFloat(memoryUsage) > 80 ? 'exception' : 'active'}
                  format={(percent) => `${(system.totalMemory - system.freeMemory).toFixed(2)} GB / ${system.totalMemory.toFixed(2)} GB`}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title="负载平均值">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text>1分钟: {system.loadAverage[0].toFixed(2)}</Text>
                  <Text>5分钟: {system.loadAverage[1].toFixed(2)}</Text>
                  <Text>15分钟: {system.loadAverage[2].toFixed(2)}</Text>
                </Space>
              </Card>
            </Col>
          </Row>
          <Descriptions bordered column={2} style={{ marginTop: 16 }}>
            <Descriptions.Item label="Node版本">{system.nodeVersion}</Descriptions.Item>
            <Descriptions.Item label="npm版本">{system.npmVersion}</Descriptions.Item>
          </Descriptions>
        </Spin>
      </Card>
    );
  };

  const renderOpenClawStatus = () => {
    if (openclawStatus.error) {
      return (
        <Card 
          title="OpenClaw状态" 
          style={{ borderColor: '#ff4d4f' }}
          extra={
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadOpenclawStatus} 
              loading={openclawStatus.loading}
              danger
              size="small"
            >
              重试
            </Button>
          }
        >
          <Alert
            message="获取OpenClaw状态失败"
            description={openclawStatus.error}
            type="error"
            showIcon
            icon={<CloseCircleOutlined />}
          />
        </Card>
      );
    }

    if (!openclawStatus.data) {
      return (
        <Card 
          title="OpenClaw状态" 
          extra={
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadOpenclawStatus} 
              loading={openclawStatus.loading}
              size="small"
            >
              刷新
            </Button>
          }
        >
          <Spin spinning={openclawStatus.loading}>
            <Alert message="正在加载OpenClaw状态..." type="info" />
          </Spin>
        </Card>
      );
    }

    const openclaw = openclawStatus.data;
    const services = openclaw.services || [];

    console.log('OpenClaw状态对象:', openclaw);
    console.log('OpenClaw是否安装:', openclaw?.installed);
    console.log('OpenClaw是否运行:', openclaw?.running);
    console.log('OpenClaw控制台URL:', openclaw?.consoleUrl);

    return (
      <Card 
        title="OpenClaw状态" 
        extra={
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadOpenclawStatus} 
            loading={openclawStatus.loading}
            size="small"
          >
            刷新
          </Button>
        }
      >
        <Spin spinning={openclawStatus.loading}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {openclaw.installed ? (
              <Alert
                message={openclaw.running ? "OpenClaw运行中" : "OpenClaw已安装"}
                description={
                  <Collapse 
                    defaultActiveKey={[]} 
                    ghost
                    items={[
                      {
                        key: '1',
                        label: '状态信息',
                        children: <Text>{openclaw.status || '未知'}</Text>
                      },
                      {
                        key: '2',
                        label: '版本信息',
                        children: <Text>{openclaw.output}</Text>
                      }
                    ]}
                  />
                }
                type={openclaw.running ? "success" : "warning"}
                showIcon
                icon={openclaw.running ? <CheckCircleOutlined /> : <WarningOutlined />}
              />
            ) : (
              <Alert
                message="OpenClaw未安装"
                description={openclaw.error || '请先安装OpenClaw'}
                type="error"
                showIcon
                icon={<CloseCircleOutlined />}
              />
            )}

            {openclaw.running && openclaw.consoleUrl && (
              <Alert
                message="OpenClaw控制台"
                description={
                  <Space>
                    <Text>控制台地址：</Text>
                    <a href={openclaw.consoleUrl} target="_blank" rel="noopener noreferrer">
                      {openclaw.consoleUrl}
                    </a>
                    <Button 
                      size="small" 
                      type="primary" 
                      icon={<LinkOutlined />}
                      onClick={() => window.open(openclaw.consoleUrl, '_blank')}
                    >
                      打开控制台
                    </Button>
                  </Space>
                }
                type="info"
                showIcon
                icon={<LinkOutlined />}
              />
            )}

            {openclaw.running && (
              <Collapse 
                defaultActiveKey={[]} 
                ghost
                items={[
                  {
                    key: 'logs',
                    label: `OpenClaw日志 (${openclawLogs.length})`,
                    children: (
                      <div 
                        style={{ 
                          backgroundColor: '#1e1e1e', 
                          color: '#d4d4d4', 
                          padding: '12px', 
                          borderRadius: '4px',
                          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                          fontSize: '12px',
                          maxHeight: '300px',
                          overflowY: 'auto',
                          lineHeight: '1.4'
                        }}
                      >
                        {openclawLogs.length > 0 ? (
                          openclawLogs.map((log, index) => (
                            <div key={index} style={{ marginBottom: '2px', color: '#4ec9b0' }}>
                              {log}
                            </div>
                          ))
                        ) : (
                          <div style={{ color: '#858585' }}>
                            暂无日志
                          </div>
                        )}
                      </div>
                    )
                  },
                  {
                    key: 'processes',
                    label: `OpenClaw进程 (${nodeProcesses.filter(p => p.isOpenClaw).length})`,
                    children: (
                      <Table
                        size="small"
                        dataSource={nodeProcesses.filter(p => p.isOpenClaw)}
                        rowKey="pid"
                        pagination={false}
                        scroll={{ y: 200 }}
                        columns={[
                          {
                            title: 'PID',
                            dataIndex: 'pid',
                            width: 80,
                            key: 'pid'
                          },
                          {
                            title: '父进程ID',
                            dataIndex: 'parentPid',
                            width: 100,
                            key: 'parentPid',
                            render: (text) => text === '0' || text === '' ? '无' : text
                          },
                          {
                            title: '命令',
                            dataIndex: 'commandLine',
                            ellipsis: true,
                            key: 'commandLine',
                            render: (text) => (
                              <Tooltip title={text}>
                                <span style={{ fontSize: '11px' }}>
                                  {text.length > 50 ? text.substring(0, 50) + '...' : text}
                                </span>
                              </Tooltip>
                            )
                          }
                        ]}
                      />
                    )
                  }
                ]}
              />
            )}

            <Card size="small" title="服务状态">
              {services.map((service, index) => (
                <div key={index} style={{ marginBottom: 8 }}>
                  <Tag color={service.status === 'success' ? 'green' : 'red'} icon={service.status === 'success' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
                    {service.name}
                  </Tag>
                  <Text style={{ marginLeft: 8 }}>{service.message}</Text>
                </div>
              ))}
            </Card>

            {openclaw.installed && (
              <Space>
                <Button 
                  type="primary" 
                  icon={<PlayCircleOutlined />} 
                  onClick={() => handleRestartOpenClaw('start')}
                  disabled={openclaw.running}
                >
                  启动
                </Button>
                <Button 
                  icon={<StopOutlined />} 
                  onClick={() => handleRestartOpenClaw('stop')}
                  disabled={!openclaw.running}
                >
                  停止
                </Button>
                <Button 
                  icon={<SyncOutlined />} 
                  onClick={() => handleRestartOpenClaw('restart')}
                  disabled={!openclaw.running}
                >
                  重启
                </Button>
              </Space>
            )}
          </Space>
        </Spin>
      </Card>
    );
  };

  const renderProcesses = () => {
    if (processes.error) {
      return (
        <Card 
          title="进程监控" 
          style={{ borderColor: '#ff4d4f' }}
          extra={
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadProcesses} 
              loading={processes.loading}
              danger
              size="small"
            >
              重试
            </Button>
          }
        >
          <Alert
            message="获取进程信息失败"
            description={processes.error}
            type="error"
            showIcon
            icon={<CloseCircleOutlined />}
          />
        </Card>
      );
    }

    if (!processes.data) {
      return (
        <Card 
          title="进程监控" 
          extra={
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadProcesses} 
              loading={processes.loading}
              size="small"
            >
              刷新
            </Button>
          }
        >
          <Spin spinning={processes.loading}>
            <Alert message="正在加载进程信息..." type="info" />
          </Spin>
        </Card>
      );
    }

    const { openclawProcesses, otherNodeProcesses, totalNodeProcesses } = processes.data || { openclawProcesses: [], otherNodeProcesses: [], totalNodeProcesses: 0 };

    const processColumns = [
      {
        title: '进程名称',
        dataIndex: 'name',
        key: 'name',
        render: (text) => <Tag color="blue">{text}</Tag>
      },
      {
        title: 'PID',
        dataIndex: 'pid',
        key: 'pid',
        render: (text, record) => (
          <Button 
            type="link"
            onClick={() => handleViewProcessDetails(record.pid)}
          >
            {text}
          </Button>
        )
      },
      {
        title: '类型',
        dataIndex: 'category',
        key: 'category',
        render: (text) => {
          const color = text === 'OpenClaw' ? 'green' : text === 'OpenClaw相关' ? 'orange' : 'blue';
          return <Tag color={color}>{text}</Tag>;
        }
      },
      {
        title: '内存使用',
        dataIndex: 'memory',
        key: 'memory',
        render: (text) => <Text>{text}</Text>
      }
    ];

    return (
      <div>
        {isRefreshing && (
          <Card 
            title={
              <Space>
                <SyncOutlined spin />
                <span>刷新进度</span>
              </Space>
            } 
            style={{ marginBottom: 16, borderColor: '#1890ff', backgroundColor: '#f0f5ff' }}
            extra={
              <Tag color="processing">
                正在刷新
              </Tag>
            }
          >
            <Progress 
              percent={refreshProgress} 
              status={refreshProgress >= 100 ? 'success' : 'active'}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </Card>
        )}

        {startingOpenClaw && (
          <Card 
            title={
              <Space>
                <SyncOutlined spin />
                <span>OpenClaw操作进度</span>
              </Space>
            } 
            style={{ marginBottom: 16, borderColor: '#1890ff', backgroundColor: '#f0f5ff' }}
            extra={
              <Tag color={openclawProgress.length > 0 ? 'processing' : 'default'}>
                {openclawProgress.length > 0 ? '执行中' : '准备中'}
              </Tag>
            }
          >
            <div 
              style={{ 
                backgroundColor: '#1e1e1e', 
                color: '#d4d4d4', 
                padding: '12px', 
                borderRadius: '4px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '13px',
                maxHeight: '300px',
                overflowY: 'auto',
                lineHeight: '1.5'
              }}
            >
              {openclawProgress.length > 0 ? (
                openclawProgress.map((item, index) => (
                  <div key={index} style={{ marginBottom: '2px' }}>
                    <span style={{ color: '#858585', marginRight: '8px' }}>
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                    <span style={{ color: '#4ec9b0' }}>
                      {item.content}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ color: '#858585' }}>
                  等待命令执行...
                </div>
              )}
            </div>
          </Card>
        )}

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Card title="OpenClaw进程" extra={
              <Tag color="green">数量: {openclawProcesses.length}</Tag>
            }>
              <Table
                columns={processColumns}
                dataSource={openclawProcesses}
                rowKey="pid"
                size="small"
                pagination={false}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card title="其他Node.js进程" extra={
              <Tag color="blue">数量: {otherNodeProcesses.length}</Tag>
            }>
              <Table
                columns={processColumns}
                dataSource={otherNodeProcesses}
                rowKey="pid"
                size="small"
                pagination={false}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card title="Node.js进程统计">
              <Statistic
                title="总Node.js进程数"
                value={totalNodeProcesses}
                valueStyle={{ color: totalNodeProcesses > 15 ? '#cf1322' : '#3f8600' }}
              />
              <Progress 
                percent={(totalNodeProcesses / 20) * 100}
                status={totalNodeProcesses > 15 ? 'exception' : 'active'}
                showInfo={false}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>运行监控</Title>
      <Paragraph>
        实时监控OpenClaw服务和Node进程状态
      </Paragraph>

      <Space style={{ marginBottom: 16 }}>
        <Button
          type={autoRefresh ? 'primary' : 'default'}
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          {autoRefresh ? '自动刷新: 开' : '自动刷新: 关'}
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadAllData}>
          全部刷新
        </Button>
      </Space>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          {renderSystemInfo()}
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          {renderOpenClawStatus()}
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          {renderProcesses()}
        </Col>
      </Row>

      <Modal
        title="进程详情"
        open={processDetailModal.visible}
        onCancel={() => setProcessDetailModal({ visible: false, data: null })}
        footer={[
          <Button key="close" onClick={() => setProcessDetailModal({ visible: false, data: null })}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {processDetailModal.data && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="进程ID">
              {processDetailModal.data.pid}
            </Descriptions.Item>
            <Descriptions.Item label="进程名称">
              {processDetailModal.data.name}
            </Descriptions.Item>
            <Descriptions.Item label="命令行">
              <Text code style={{ fontSize: 12 }}>
                {processDetailModal.data.commandLine || 'N/A'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="内存使用">
              {processDetailModal.data.memoryMB ? `${processDetailModal.data.memoryMB} MB` : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="启动时间">
              {processDetailModal.data.startTime || 'N/A'}
            </Descriptions.Item>
            {processDetailModal.data.error && (
              <Descriptions.Item label="错误">
                <Alert message={processDetailModal.data.error} type="error" />
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default RuntimeMonitor;