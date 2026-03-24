import React, { useState, useEffect, useRef } from 'react';
import { Card, Table, Tag, Button, Space, message, Modal, Descriptions, Typography, Row, Col,Statistic, Alert } from 'antd';
import { ReloadOutlined, DesktopOutlined, MobileOutlined, TabletOutlined, GlobalOutlined } from '@ant-design/icons';
import clientMonitorService from '../services/clientMonitorService';

const { Title, Text } = Typography;

const ClientMonitor = () => {
  const [clientList, setClientList] = useState({ data: [], loading: false, error: null });
  const [selectedClient, setSelectedClient] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    loadClientList();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(loadClientList, 30000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [autoRefresh]);

  const loadClientList = async () => {
    setClientList(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await clientMonitorService.getClientList({ pageSize: 100 });
      if (response.success) {
        setClientList({ data: response.data.list || [], loading: false, error: null });
      } else {
        setClientList(prev => ({ ...prev, loading: false, error: response.message }));
      }
    } catch (error) {
      setClientList({ data: [], loading: false, error: error.message });
    }
  };

  const showClientDetail = async (record) => {
    try {
      const response = await clientMonitorService.getClientDetail(record.device_id);
      if (response.success) {
        setSelectedClient(response.data);
        setDetailModalVisible(true);
      } else {
        message.error(response.message);
      }
    } catch (error) {
      message.error('获取客户端详情失败');
    }
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType) {
      case 'mobile': return <MobileOutlined />;
      case 'tablet': return <TabletOutlined />;
      default: return <DesktopOutlined />;
    }
  };

  const getOnlineStatus = (lastHeartbeat) => {
    if (!lastHeartbeat) return <Tag color="default">未知</Tag>;
    const diff = Date.now() - new Date(lastHeartbeat).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 5) return <Tag color="success">在线</Tag>;
    if (minutes < 30) return <Tag color="processing">活跃</Tag>;
    return <Tag color="default">离线</Tag>;
  };

  const columns = [
    {
      title: '设备ID',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 200,
      ellipsis: true,
      render: (text) => <Text code>{text}</Text>
    },
    {
      title: '设备类型',
      dataIndex: 'deviceType',
      key: 'deviceType',
      width: 100,
      render: (type, record) => (
        <Space>
          {getDeviceIcon(type)}
          {type || 'desktop'}
        </Space>
      )
    },
    {
      title: '操作系统',
      key: 'os',
      width: 150,
      render: (_, record) => (
        <span>{record.osName} {record.osVersion}</span>
      )
    },
    {
      title: '浏览器',
      key: 'browser',
      width: 150,
      render: (_, record) => (
        <span>{record.browserName} {record.browserVersion}</span>
      )
    },
    {
      title: '屏幕',
      dataIndex: 'screenResolution',
      key: 'screenResolution',
      width: 120
    },
    {
      title: '语言',
      dataIndex: 'language',
      key: 'language',
      width: 80
    },
    {
      title: '状态',
      dataIndex: 'lastHeartbeat',
      key: 'status',
      width: 100,
      render: (time) => getOnlineStatus(time)
    },
    {
      title: '最后活跃',
      dataIndex: 'lastHeartbeat',
      key: 'lastHeartbeat',
      width: 160,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : 'N/A'
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => showClientDetail(record)}>
          详情
        </Button>
      )
    }
  ];

  const renderStats = () => {
    const total = clientList.data?.length || 0;
    const online = clientList.data?.filter(c => {
      if (!c.lastHeartbeat) return false;
      return Date.now() - new Date(c.lastHeartbeat).getTime() < 300000;
    }).length || 0;
    const desktop = clientList.data?.filter(c => c.deviceType === 'desktop').length || 0;
    const mobile = clientList.data?.filter(c => c.deviceType === 'mobile' || c.deviceType === 'tablet').length || 0;

    return (
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Statistic title="总设备数" value={total} valueStyle={{ color: '#1890ff' }} />
        </Col>
        <Col span={6}>
          <Statistic title="在线设备" value={online} valueStyle={{ color: '#52c41a' }} />
        </Col>
        <Col span={6}>
          <Statistic title="桌面端" value={desktop} suffix={`/ ${total}`} />
        </Col>
        <Col span={6}>
          <Statistic title="移动端" value={mobile} suffix={`/ ${total}`} />
        </Col>
      </Row>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>客户端监控</Title>
      <Paragraph type="secondary">
        实时监控客户端浏览器和系统信息
      </Paragraph>

      <Space style={{ marginBottom: 16 }}>
        <Button
          type={autoRefresh ? 'primary' : 'default'}
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          {autoRefresh ? '自动刷新: 开' : '自动刷新: 关'}
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadClientList} loading={clientList.loading}>
          刷新
        </Button>
      </Space>

      {renderStats()}

      <Card>
        {clientList.error ? (
          <Alert
            message="获取客户端列表失败"
            description={clientList.error}
            type="error"
            showIcon
          />
        ) : (
          <Table
            columns={columns}
            dataSource={clientList.data}
            rowKey="id"
            loading={clientList.loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      <Modal
        title="客户端详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {selectedClient && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="设备ID" span={2}>
              <Text code>{selectedClient.device_id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="设备类型">
              <Space>{getDeviceIcon(selectedClient.deviceType)} {selectedClient.deviceType}</Space>
            </Descriptions.Item>
            <Descriptions.Item label="平台">{selectedClient.platform}</Descriptions.Item>
            <Descriptions.Item label="操作系统" span={2}>
              {selectedClient.osName} {selectedClient.osVersion}
            </Descriptions.Item>
            <Descriptions.Item label="浏览器" span={2}>
              {selectedClient.browserName} {selectedClient.browserVersion}
            </Descriptions.Item>
            <Descriptions.Item label="屏幕分辨率">{selectedClient.screenResolution}</Descriptions.Item>
            <Descriptions.Item label="颜色深度">{selectedClient.colorDepth}</Descriptions.Item>
            <Descriptions.Item label="CPU核心数">{selectedClient.hardwareConcurrency}</Descriptions.Item>
            <Descriptions.Item label="设备内存">{selectedClient.deviceMemory}</Descriptions.Item>
            <Descriptions.Item label="语言">{selectedClient.language}</Descriptions.Item>
            <Descriptions.Item label="时区">{selectedClient.timezone}</Descriptions.Item>
            <Descriptions.Item label="网络类型">{selectedClient.connectionType}</Descriptions.Item>
            <Descriptions.Item label="Cookie启用">{selectedClient.cookieEnabled ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="Do Not Track">{selectedClient.doNotTrack}</Descriptions.Item>
            <Descriptions.Item label="邀请码">{selectedClient.invitation_code || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="最后活跃">
              {selectedClient.lastHeartbeat ? new Date(selectedClient.lastHeartbeat).toLocaleString('zh-CN') : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="来源" span={2}>{selectedClient.referrer}</Descriptions.Item>
            <Descriptions.Item label="当前URL" span={2}>
              <Text ellipsis copyable>{selectedClient.currentUrl}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="User-Agent" span={2}>
              <Text style={{ fontSize: 11 }}>{selectedClient.userAgent}</Text>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default ClientMonitor;