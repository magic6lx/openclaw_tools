import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Tag,
  message,
  Popconfirm,
  Statistic,
  Row,
  Col,
  Tooltip,
  Tabs,
  Badge,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  FilterOutlined,
  UserOutlined,
  MobileOutlined,
  CopyOutlined,
  BugOutlined,
} from '@ant-design/icons';
import { logService } from '../services/log';
import localLauncherService from '../services/localLauncherService';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TabPane } = Tabs;

function LogManagement() {
  const [activeTab, setActiveTab] = useState('server');
  const [serverLogs, setServerLogs] = useState([]);
  const [launcherLogs, setLauncherLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [launcherLoading, setLauncherLoading] = useState(false);
  const [filters, setFilters] = useState({
    operation_stage: undefined,
    level: undefined,
    query: '',
    start_date: undefined,
    end_date: undefined,
  });
  const [launcherFilters, setLauncherFilters] = useState({
    level: 'all',
    query: '',
  });
  const [stats, setStats] = useState({
    total_logs: 0,
    logs_by_stage: [],
    logs_by_level: [],
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [dateRange, setDateRange] = useState([dayjs().startOf('day'), dayjs().endOf('day')]);
  const [launcherStats, setLauncherStats] = useState({
    total: 0,
    errorCount: 0,
  });

  useEffect(() => {
    loadLogs();
    loadStats();
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => {
    if (activeTab === 'launcher') {
      loadLauncherLogs();
    }
  }, [activeTab, launcherFilters]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await logService.getLogs({
        ...filters,
        page: pagination.current,
        limit: pagination.pageSize,
      });
      if (response.success) {
        setServerLogs(response.data.logs || []);
        setPagination({
          ...pagination,
          total: response.data.total || 0,
        });
      } else {
        console.warn('获取日志失败:', response);
        setServerLogs([]);
      }
    } catch (error) {
      console.error('加载日志失败:', error);
      message.error('加载日志失败: ' + (error.message || '网络错误'));
      setServerLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await logService.getLogStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  const loadLauncherLogs = async () => {
    setLauncherLoading(true);
    try {
      const response = await localLauncherService.getLauncherLogs(500);
      if (response.success) {
        let logs = response.logs || [];

        if (launcherFilters.level !== 'all') {
          logs = logs.filter(log => log.level === launcherFilters.level);
        }

        if (launcherFilters.query) {
          const q = launcherFilters.query.toLowerCase();
          logs = logs.filter(log =>
            (log.message && log.message.toLowerCase().includes(q)) ||
            (log.invitation_code && log.invitation_code.toLowerCase().includes(q)) ||
            (log.device_id && log.device_id.toLowerCase().includes(q))
          );
        }

        setLauncherLogs(logs);
        setLauncherStats({
          total: response.total || 0,
          errorCount: (response.logs || []).filter(l => l.level === 'error').length,
        });
      } else {
        message.warning('无法加载Launcher日志: ' + (response.error || '未知错误'));
        setLauncherLogs([]);
      }
    } catch (error) {
      message.error('加载Launcher日志失败');
    } finally {
      setLauncherLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
  };

  const handleReset = () => {
    setFilters({
      operation_stage: undefined,
      level: undefined,
      query: '',
      start_date: undefined,
      end_date: undefined,
    });
    setDateRange([dayjs().startOf('day'), dayjs().endOf('day')]);
    setPagination({ ...pagination, current: 1 });
  };

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    if (dates && dates[0] && dates[1]) {
      setFilters({
        ...filters,
        start_date: dates[0].format('YYYY-MM-DD HH:mm:ss'),
        end_date: dates[1].format('YYYY-MM-DD HH:mm:ss'),
      });
    } else {
      setFilters({
        ...filters,
        start_date: undefined,
        end_date: undefined,
      });
    }
  };

  const handleDelete = async () => {
    try {
      const response = await logService.deleteLogs(filters);
      if (response.success) {
        message.success(response.data.message);
        loadLogs();
        loadStats();
      }
    } catch (error) {
      message.error('删除日志失败');
    }
  };

  const getOperationStageColor = (stage) => {
    const colors = {
      installation: 'blue',
      configuration: 'orange',
      runtime: 'green',
    };
    return colors[stage] || 'default';
  };

  const getOperationStageText = (stage) => {
    const texts = {
      installation: '安装过程',
      configuration: '配置过程',
      runtime: '运行过程',
    };
    return texts[stage] || stage;
  };

  const getLogLevelColor = (level) => {
    const colors = {
      debug: 'default',
      info: 'blue',
      warn: 'orange',
      error: 'red',
    };
    return colors[level] || 'default';
  };

  const handleCopyLogs = async () => {
    try {
      const logText = serverLogs.map(log => {
        const user = log.user_id || '系统';
        const stage = getOperationStageText(log.operation_stage);
        const level = log.level;
        const content = log.content;
        const time = new Date(log.created_at).toLocaleString();
        return `[${time}] [${user}] [${stage}] [${level}] ${content}`;
      }).join('\n');

      await navigator.clipboard.writeText(logText);
      message.success(`已复制 ${serverLogs.length} 条日志到剪贴板`);
    } catch (error) {
      message.error('复制失败，请手动复制');
      console.error('复制失败:', error);
    }
  };

  const handleCopyLauncherLogs = async () => {
    try {
      const logText = launcherLogs.map(log => {
        const time = log.timestamp ? new Date(parseInt(log.timestamp)).toLocaleString() : '';
        const level = log.level || 'info';
        const msg = log.message || '';
        const code = log.invitation_code || '';
        const device = log.device_id || '';
        return `[${time}] [${level.toUpperCase()}] [code=${code}] [device=${device}] ${msg}`;
      }).join('\n');

      await navigator.clipboard.writeText(logText);
      message.success(`已复制 ${launcherLogs.length} 条日志到剪贴板`);
    } catch (error) {
      message.error('复制失败，请手动复制');
    }
  };

  const serverColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户',
      key: 'user',
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <Tooltip title="用户ID">
            <Tag icon={<UserOutlined />} color="blue">
              {record.user_id || '系统'}
            </Tag>
          </Tooltip>
          {record.invitation_code && (
            <Tooltip title="邀请码">
              <Tag color="cyan">
                {record.invitation_code}
              </Tag>
            </Tooltip>
          )}
          {record.device_id && (
            <Tooltip title="设备ID">
              <Tag icon={<MobileOutlined />} color="green">
                {record.device_id}
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '操作阶段',
      dataIndex: 'operation_stage',
      key: 'operation_stage',
      width: 120,
      render: (stage) => (
        <Tag color={getOperationStageColor(stage)}>
          {getOperationStageText(stage)}
        </Tag>
      ),
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level) => <Tag color={getLogLevelColor(level)}>{level}</Tag>,
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date) => new Date(date).toLocaleString(),
    },
  ];

  const launcherColumns = [
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level) => {
        const colorMap = {
          error: 'red',
          warn: 'orange',
          info: 'blue',
          debug: 'default',
        };
        return <Tag color={colorMap[level] || 'default'}>{level?.toUpperCase()}</Tag>;
      },
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (ts) => ts || '-',
    },
    {
      title: '邀请码',
      dataIndex: 'invitation_code',
      key: 'invitation_code',
      width: 140,
      render: (code) => code ? <Tag color="cyan">{code}</Tag> : <Tag color="default">-</Tag>,
    },
    {
      title: '设备ID',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 160,
      render: (id) => id ? <Tag icon={<MobileOutlined />} color="green">{id.substring(0, 12)}...</Tag> : <Tag color="default">-</Tag>,
    },
    {
      title: '日志内容',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (msg) => <Tooltip title={msg}>{msg}</Tooltip>,
    },
  ];

  const filteredLauncherLogs = launcherLogs.filter(log => {
    if (launcherFilters.level !== 'all' && log.level !== launcherFilters.level) {
      return false;
    }
    if (launcherFilters.query) {
      const q = launcherFilters.query.toLowerCase();
      return (log.message && log.message.toLowerCase().includes(q)) ||
             (log.invitation_code && log.invitation_code.toLowerCase().includes(q)) ||
             (log.device_id && log.device_id.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="日志总数"
              value={stats.total_logs}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        {stats.logs_by_stage.map((item) => (
          <Col xs={24} sm={12} md={6} key={item.operation_stage}>
            <Card>
              <Statistic
                title={getOperationStageText(item.operation_stage)}
                value={item.count}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="服务端日志" key="server">
            <Space style={{ marginBottom: 16 }} wrap>
              <Input
                placeholder="搜索日志内容"
                prefix={<SearchOutlined />}
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                style={{ width: 200 }}
                onPressEnter={handleSearch}
              />
              <RangePicker
                showTime
                value={dateRange}
                onChange={handleDateRangeChange}
                style={{ width: 350 }}
              />
              <Select
                placeholder="操作阶段"
                value={filters.operation_stage}
                onChange={(value) => setFilters({ ...filters, operation_stage: value })}
                style={{ width: 120 }}
                allowClear
              >
                <Option value="installation">安装过程</Option>
                <Option value="configuration">配置过程</Option>
                <Option value="runtime">运行过程</Option>
              </Select>
              <Select
                placeholder="日志级别"
                value={filters.level}
                onChange={(value) => setFilters({ ...filters, level: value })}
                style={{ width: 100 }}
                allowClear
              >
                <Option value="debug">Debug</Option>
                <Option value="info">Info</Option>
                <Option value="warn">Warn</Option>
                <Option value="error">Error</Option>
              </Select>
              <Button type="primary" icon={<FilterOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>

            <Space style={{ marginBottom: 16 }}>
              <Button icon={<CopyOutlined />} onClick={handleCopyLogs}>
                复制本页
              </Button>
              <Popconfirm
                title="确认删除"
                description="确定要删除符合条件的日志吗？"
                onConfirm={handleDelete}
                okText="确定"
                cancelText="取消"
              >
                <Button danger icon={<DeleteOutlined />}>
                  删除日志
                </Button>
              </Popconfirm>
              <Button icon={<ReloadOutlined />} onClick={loadLogs}>
                刷新
              </Button>
            </Space>

            <Table
              columns={serverColumns}
              dataSource={serverLogs}
              rowKey="id"
              loading={loading}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
                onChange: (page, pageSize) => {
                  setPagination({ ...pagination, current: page, pageSize });
                },
              }}
              scroll={{ x: 800 }}
            />
          </TabPane>

          <TabPane
            tab={
              <span>
                Launcher日志
                {launcherStats.errorCount > 0 && (
                  <Badge count={launcherStats.errorCount} style={{ marginLeft: 8 }} />
                )}
              </span>
            }
            key="launcher"
          >
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Statistic title="Launcher日志总数" value={launcherStats.total} />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Error数量"
                  value={launcherStats.errorCount}
                  valueStyle={{ color: launcherStats.errorCount > 0 ? '#ff4d4f' : '#52c41a' }}
                  prefix={<BugOutlined />}
                />
              </Col>
            </Row>

            <Space style={{ marginBottom: 16 }} wrap>
              <Input
                placeholder="搜索日志内容/邀请码/设备ID"
                prefix={<SearchOutlined />}
                value={launcherFilters.query}
                onChange={(e) => setLauncherFilters({ ...launcherFilters, query: e.target.value })}
                style={{ width: 280 }}
                allowClear
              />
              <Select
                value={launcherFilters.level}
                onChange={(value) => setLauncherFilters({ ...launcherFilters, level: value })}
                style={{ width: 120 }}
              >
                <Option value="all">全部级别</Option>
                <Option value="error">Error</Option>
                <Option value="warn">Warn</Option>
                <Option value="info">Info</Option>
                <Option value="debug">Debug</Option>
              </Select>
              <Button
                type={launcherFilters.level === 'error' ? 'primary' : 'default'}
                danger
                icon={<BugOutlined />}
                onClick={() => setLauncherFilters({ ...launcherFilters, level: launcherFilters.level === 'error' ? 'all' : 'error' })}
              >
                只看Error
              </Button>
              <Button icon={<CopyOutlined />} onClick={handleCopyLauncherLogs}>
                复制本页
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadLauncherLogs}>
                刷新
              </Button>
            </Space>

            <Table
              columns={launcherColumns}
              dataSource={filteredLauncherLogs}
              rowKey={(record, index) => `${record.timestamp}-${index}`}
              loading={launcherLoading}
              pagination={{
                pageSize: 50,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
              }}
              scroll={{ x: 900 }}
              size="small"
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}

export default LogManagement;
