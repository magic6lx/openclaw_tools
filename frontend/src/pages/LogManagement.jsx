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
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DeleteOutlined,
  FilterOutlined,
  UserOutlined,
  MobileOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { logService } from '../services/log';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

function LogManagement() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    operation_stage: undefined,
    level: undefined,
    query: '',
    start_date: undefined,
    end_date: undefined,
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

  useEffect(() => {
    loadLogs();
    loadStats();
  }, [pagination.current, pagination.pageSize, filters]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await logService.getLogs({
        ...filters,
        page: pagination.current,
        limit: pagination.pageSize,
      });
      if (response.success) {
        setLogs(response.data.logs);
        setPagination({
          ...pagination,
          total: response.data.total,
        });
      }
    } catch (error) {
      message.error('加载日志失败');
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
      const logText = logs.map(log => {
        const user = log.user_id || '系统';
        const stage = getOperationStageText(log.operation_stage);
        const level = log.level;
        const content = log.content;
        const time = new Date(log.created_at).toLocaleString();
        return `[${time}] [${user}] [${stage}] [${level}] ${content}`;
      }).join('\n');

      await navigator.clipboard.writeText(logText);
      message.success(`已复制 ${logs.length} 条日志到剪贴板`);
    } catch (error) {
      message.error('复制失败，请手动复制');
      console.error('复制失败:', error);
    }
  };

  const columns = [
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
                valueStyle={{
                  color: '#3f8600',
                }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        title="日志管理"
        extra={
          <Space>
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
        }
      >
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

        <Table
          columns={columns}
          dataSource={logs}
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
      </Card>
    </div>
  );
}

export default LogManagement;