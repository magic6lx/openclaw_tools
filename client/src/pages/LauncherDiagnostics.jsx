import React, { useState } from 'react';
import { Card, Typography, Button, Space, Tag, message, Descriptions, Alert, Divider, List } from 'antd';
import { BugOutlined, CheckCircleOutlined, CloseCircleOutlined, RocketOutlined, FileTextOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const LAUNCHER_ENDPOINTS = [
  { url: 'http://127.0.0.1:3003/status', name: '127.0.0.1:3003/status' },
  { url: 'http://localhost:3003/status', name: 'localhost:3003/status' },
  { url: 'http://127.0.0.1:18789/status', name: '127.0.0.1:18789/status' },
  { url: 'http://localhost:18789/status', name: 'localhost:18789/status' },
];

function LauncherDiagnostics() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState([]);
  const [tested, setTested] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const testLauncherEndpoint = async (endpoint) => {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(endpoint.url, {
        signal: controller.signal,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      const data = await res.json();

      return {
        ...endpoint,
        success: true,
        status: res.status,
        duration,
        data,
        error: null
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      return {
        ...endpoint,
        success: false,
        error: err.message,
        duration,
        data: null
      };
    }
  };

  const runDiagnostics = async () => {
    setTesting(true);
    setResults([]);

    const testResults = [];
    for (const endpoint of LAUNCHER_ENDPOINTS) {
      const result = await testLauncherEndpoint(endpoint);
      testResults.push(result);
      setResults([...testResults]);
    }

    setTesting(false);
    setTested(true);
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch('http://127.0.0.1:3003/logs?limit=50', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (data.logs && data.logs.length === 0) {
          message.info('暂无日志');
        }
      } else {
        message.error('获取日志失败');
      }
    } catch (err) {
      message.error('获取日志失败: ' + err.message);
    }
    setLoadingLogs(false);
  };

  const getStatusTag = (result) => {
    if (!tested) return <Tag color="default">未测试</Tag>;
    if (result.success) return <Tag icon={<CheckCircleOutlined />} color="success">可达</Tag>;
    return <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>;
  };

  const successfulResult = results.find(r => r.success);

  const getOpenClawStatusInfo = (data) => {
    if (!data || !data.openClawStatus) {
      return { color: 'default', text: '未知', desc: 'API未返回openClawStatus字段' };
    }

    const status = data.openClawStatus;
    if (status === 'running') {
      return { color: 'green', text: '运行中', desc: 'OpenClaw正在运行' };
    }
    if (status === 'installed') {
      return { color: 'green', text: '已安装', desc: 'OpenClaw已安装但未运行' };
    }
    if (status === 'not_installed') {
      return { color: 'orange', text: '未安装', desc: 'Launcher未检测到OpenClaw安装' };
    }
    return { color: 'default', text: status, desc: `未知状态: ${status}` };
  };

  return (
    <Card>
      <Title level={5}>
        <BugOutlined /> Launcher 连接诊断
      </Title>
      <Paragraph type="secondary">
        检测Launcher服务的可用性，查看openClawStatus等详细状态信息。
      </Paragraph>

      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          onClick={runDiagnostics}
          loading={testing}
          icon={<BugOutlined />}
        >
          开始诊断
        </Button>
        <Button
          onClick={fetchLogs}
          loading={loadingLogs}
          icon={<FileTextOutlined />}
        >
          查看日志
        </Button>
        {successfulResult && (
          <Button
            onClick={() => setShowRaw(!showRaw)}
            icon={<RocketOutlined />}
          >
            {showRaw ? '隐藏' : '显示'}原始JSON
          </Button>
        )}
      </Space>

      {tested && results.length > 0 && (
        <>
          <Alert
            type={successfulResult ? "success" : "error"}
            message={
              successfulResult
                ? "找到可用的Launcher端点！"
                : "未找到可用的Launcher服务"
            }
            style={{ marginBottom: 16 }}
            showIcon
          />

          <Descriptions bordered column={1} size="small">
            {results.map((result, index) => (
              <Descriptions.Item
                label={
                  <Space>
                    <span>{result.name}</span>
                    {getStatusTag(result)}
                  </Space>
                }
              >
                {result.success ? (
                  <div>
                    <Text type="success">响应时间: {result.duration}ms</Text>

                    {result.data && (
                      <>
                        <Divider style={{ margin: '12px 0' }} />
                        <Space wrap style={{ marginBottom: 8 }}>
                          <Tag color={result.data.gatewayRunning ? 'green' : 'red'}>
                            Gateway: {result.data.gatewayRunning ? '运行中' : '已停止'}
                          </Tag>
                          <Tag color={result.data.launcherRunning ? 'green' : 'red'}>
                            Launcher: {result.data.launcherRunning ? '运行中' : '已停止'}
                          </Tag>
                          {(() => {
                            const info = getOpenClawStatusInfo(result.data);
                            return <Tag color={info.color}>{info.text}</Tag>;
                          })()}
                        </Space>
                        <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                          {(() => {
                            const info = getOpenClawStatusInfo(result.data);
                            return info.desc;
                          })()}
                        </div>

                        {showRaw && (
                          <pre style={{
                            background: '#f5f5f5',
                            padding: 12,
                            borderRadius: 4,
                            marginTop: 12,
                            fontSize: 12,
                            maxHeight: 300,
                            overflow: 'auto',
                            border: '1px solid #d9d9d9'
                          }}>
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <Text type="danger">
                    {result.error === 'The user aborted a request.'
                      ? '请求超时（3秒）'
                      : result.error}
                  </Text>
                )}
              </Descriptions.Item>
            ))}
          </Descriptions>

          {successfulResult && (
            <Alert
              type="info"
              message="诊断结果"
              description={
                <div>
                  <Paragraph style={{ marginBottom: 8 }}>
                    Launcher API 返回的 <Text code>openClawStatus</Text> 值为：
                  </Paragraph>
                  <Tag color={getOpenClawStatusInfo(successfulResult.data).color} style={{ fontSize: 16, padding: '4px 12px' }}>
                    {successfulResult.data.openClawStatus || '未返回'}
                  </Tag>
                  <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                    {getOpenClawStatusInfo(successfulResult.data).desc}
                  </Paragraph>
                  <Divider style={{ margin: '12px 0' }} />
                  <Paragraph type="secondary" style={{ marginBottom: 4 }}>
                    <strong>可能原因：</strong>
                  </Paragraph>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>Launcher检测OpenClaw的安装路径与你实际安装路径不同</li>
                    <li>OpenClaw安装在了非标准路径</li>
                    <li>Launcher需要以管理员权限运行才能检测到OpenClaw</li>
                    <li>Launcher版本与OpenClaw检测逻辑不匹配</li>
                  </ul>
                </div>
              }
              style={{ marginTop: 16 }}
            />
          )}
        </>
      )}

      {logs.length > 0 && (
        <>
          <Divider style={{ marginTop: 24 }} />
          <Title level={5}>
            <FileTextOutlined /> Launcher 运行日志
          </Title>
          <List
            size="small"
            bordered
            dataSource={logs}
            style={{
              maxHeight: 400,
              overflow: 'auto',
              background: '#1e1e1e',
              color: '#d4d4d4',
              fontFamily: 'monospace',
              fontSize: 12
            }}
            renderItem={(log) => (
              <List.Item style={{
                padding: '4px 12px',
                borderBottom: '1px solid #333',
                margin: 0
              }}>
                <Space size="small" style={{ width: '100%', justifyContent: 'flex-start' }}>
                  <Text type="secondary" style={{ color: '#888', fontSize: 10 }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </Text>
                  <Tag color={log.level === 'ERROR' ? 'red' : log.level === 'INFO' ? 'blue' : 'default'} style={{ fontSize: 10, margin: 0 }}>
                    {log.level}
                  </Tag>
                  <Text style={{ color: log.level === 'ERROR' ? '#f48771' : '#d4d4d4' }}>
                    {log.message}
                  </Text>
                </Space>
              </List.Item>
            )}
          />
        </>
      )}

      {!tested && (
        <Alert
          type="info"
          message='点击"开始诊断"按钮，查看Launcher API返回的详细状态'
          description={
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              <li><Text code>openClawStatus</Text> - OpenClaw安装状态</li>
              <li><Text code>gatewayRunning</Text> - Gateway服务状态</li>
              <li><Text code>launcherRunning</Text> - Launcher服务状态</li>
            </ul>
          }
          style={{ marginTop: 16 }}
        />
      )}
    </Card>
  );
}

export default LauncherDiagnostics;