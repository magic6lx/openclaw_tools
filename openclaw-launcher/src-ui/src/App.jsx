import React, { useState, useEffect } from 'react';
import { Card, Tag, Space, Typography, Spin, Modal, Collapse, List } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, HistoryOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const LAUNCHER_VERSION = 'v1.0.3';
const LAUNCHER_HTTP_PORT = 18790;
const GATEWAY_PORT = 18789;

function App() {
  const [launcherRunning, setLauncherRunning] = useState(true);
  const [serverConnected, setServerConnected] = useState(false);
  const [gatewayRunning, setGatewayRunning] = useState(false);
  const [gatewayPort, setGatewayPort] = useState(null);
  const [loading, setLoading] = useState(true);
  const [changelogVisible, setChangelogVisible] = useState(false);
  const [changelog, setChangelog] = useState([]);

  useEffect(() => {
    checkStatus();
    loadChangelog();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const launcherRes = await fetch(`http://localhost:${LAUNCHER_HTTP_PORT}/api/status`);
      if (launcherRes.ok) {
        setLauncherRunning(true);
        const data = await launcherRes.json();
        setGatewayRunning(data.gateway_running || false);
        setGatewayPort(data.gateway_port || null);
      }
    } catch (e) {
      setLauncherRunning(false);
    }

    try {
      const serverRes = await fetch('http://134.175.18.139:3001/api/health');
      setServerConnected(serverRes.ok);
    } catch (e) {
      setServerConnected(false);
    }
    setLoading(false);
  };

  const loadChangelog = async () => {
    try {
      const res = await fetch(`http://localhost:${LAUNCHER_HTTP_PORT}/api/changelog`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.versions) {
          setChangelog(data.versions);
        }
      }
    } catch (e) {
      console.error('Failed to load changelog');
    }
  };

  const showChangelog = () => setChangelogVisible(true);

  return (
    <div style={{ padding: 16, background: '#f0f0f0', minHeight: '100vh' }}>
      <Card
        title={<Title level={4} style={{ margin: 0 }}>OpenClaw Launcher</Title>}
        extra={
          <Tag color="blue" style={{ cursor: 'pointer' }} onClick={showChangelog}>
            {LAUNCHER_VERSION} <HistoryOutlined />
          </Tag>
        }
        style={{ width: 380 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text>Launcher 服务</Text>
            {loading ? (
              <Spin size="small" />
            ) : launcherRunning ? (
              <Tag color="blue" icon={<CheckCircleOutlined />}>运行中</Tag>
            ) : (
              <Tag color="red" icon={<CloseCircleOutlined />}>未运行</Tag>
            )}
          </Space>

          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text>服务端连接</Text>
            {loading ? (
              <Spin size="small" />
            ) : serverConnected ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>已连接</Tag>
            ) : (
              <Tag color="red" icon={<CloseCircleOutlined />}>未连接</Tag>
            )}
          </Space>

          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text>OpenClaw Gateway</Text>
            {loading ? (
              <Spin size="small" />
            ) : gatewayRunning ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>
                运行中 {gatewayPort ? `(端口 ${gatewayPort})` : `(端口 ${GATEWAY_PORT})`}
              </Tag>
            ) : (
              <Tag color="gray" icon={<CloseCircleOutlined />}>未启动</Tag>
            )}
          </Space>
        </Space>
      </Card>

      <Modal
        title="更新日志"
        open={changelogVisible}
        onCancel={() => setChangelogVisible(false)}
        footer={null}
        width={500}
      >
        <Collapse
          bordered={false}
          items={changelog.map((v, idx) => ({
            key: v.version,
            label: (
              <Space>
                <Tag color={idx === 0 ? 'green' : 'blue'}>{v.version}</Tag>
                {v.date && <Text type="secondary" style={{ fontSize: 12 }}>{v.date}</Text>}
              </Space>
            ),
            children: v.changes.length > 0 ? (
              v.changes.map((change, cIdx) => (
                <div key={cIdx} style={{ marginBottom: 8 }}>
                  <Tag color={change.type === '新增' ? 'green' : change.type === '修复' ? 'red' : 'blue'}>
                    {change.type}
                  </Tag>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                    {change.items.map((item, iIdx) => (
                      <li key={iIdx} style={{ color: '#666' }}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <Text type="secondary">暂无详细更新说明</Text>
            )
          }))}
        />
      </Modal>
    </div>
  );
}

export default App;