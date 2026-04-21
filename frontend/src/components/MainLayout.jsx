import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Divider, Tag, Modal, Collapse } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  SettingOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  AppstoreOutlined,
  LogoutOutlined,
  UserOutlined,
  KeyOutlined,
  TeamOutlined,
  FolderOpenOutlined,
  DownloadOutlined,
  MonitorOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { authService } from '../services/auth';
import launcherService from '../services/launcherService';

const { Header, Sider, Content } = Layout;

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [changelogVisible, setChangelogVisible] = useState(false);
  const [changelog, setChangelog] = useState([]);

  const user = authService.getUser();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadChangelog();
  }, []);

  const loadChangelog = async () => {
    const result = await launcherService.getChangelog();
    if (result.success && result.versions) {
      setChangelog(result.versions);
    }
  };

  const showChangelog = () => {
    setChangelogVisible(true);
  };

  const userMenuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '操作指引',
    },
    {
      key: '/openclaw-install',
      icon: <DownloadOutlined />,
      label: '一键安装',
    },
    {
      key: '/wizard',
      icon: <ExperimentOutlined />,
      label: '配置向导',
    },
    {
      key: '/runtime-monitor',
      icon: <MonitorOutlined />,
      label: '运行监控',
    },
  ];

  const adminMenuItems = [
    {
      key: '/templates',
      icon: <AppstoreOutlined />,
      label: '模版管理',
    },
    {
      key: '/invitation-codes',
      icon: <KeyOutlined />,
      label: '邀请码管理',
    },
    {
      key: '/users',
      icon: <TeamOutlined />,
      label: '用户管理',
    },
    {
      key: '/logs',
      icon: <FileTextOutlined />,
      label: '日志管理',
    },
  ];

  const allMenuItems = [
    ...userMenuItems,
    ...(isAdmin ? adminMenuItems : []),
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      authService.clearAuth();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      authService.clearAuth();
      navigate('/login');
    }
  };

  const userDropdownItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      onClick: () => navigate('/dashboard'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: collapsed ? 16 : 20,
            fontWeight: 'bold',
          }}
        >
          {collapsed ? 'OC' : 'OpenClaw'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          onClick={handleMenuClick}
        >
          {!collapsed && (
            <Menu.ItemGroup title="用户功能">
              {userMenuItems.map(item => (
                <Menu.Item key={item.key} icon={item.icon}>
                  {item.label}
                </Menu.Item>
              ))}
            </Menu.ItemGroup>
          )}
          {collapsed && userMenuItems.map(item => (
            <Menu.Item key={item.key} icon={item.icon}>
              {item.label}
            </Menu.Item>
          ))}
          
          {isAdmin && !collapsed && (
            <Menu.ItemGroup title="管理员功能">
              {adminMenuItems.map(item => (
                <Menu.Item key={item.key} icon={item.icon}>
                  {item.label}
                </Menu.Item>
              ))}
            </Menu.ItemGroup>
          )}
          {isAdmin && collapsed && adminMenuItems.map(item => (
            <Menu.Item key={item.key} icon={item.icon}>
              {item.label}
            </Menu.Item>
          ))}
        </Menu>
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 500 }}>
            OpenClaw智能配置系统
          </div>
          <Space>
            <Text type="secondary" style={{ cursor: 'pointer', fontSize: 12 }} onClick={showChangelog}>
              v1.0.3 {changelog.length > 0 && <HistoryOutlined />}
            </Text>
            <Dropdown menu={{ items: userDropdownItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user?.device_name || '用户'}</span>
                {isAdmin && <Tag color="blue">管理员</Tag>}
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            background: '#fff',
            borderRadius: 8,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>

      <Modal
        title="更新日志"
        open={changelogVisible}
        onCancel={() => setChangelogVisible(false)}
        footer={null}
        width={600}
      >
        <Collapse
          bordered={false}
          items={changelog.map((v, idx) => ({
            key: v.version,
            label: <><Tag color={idx === 0 ? 'green' : 'blue'}>v{v.version}</Tag> {v.date && <Text type="secondary" style={{ fontSize: 12 }}>{v.date}</Text>}</>,
            children: v.changes.length > 0 ? (
              v.changes.map((change, cIdx) => (
                <div key={cIdx} style={{ marginBottom: 8 }}>
                  <Tag color={change.type === '新增' ? 'green' : change.type === '修复' ? 'red' : 'blue'} style={{ marginRight: 8 }}>{change.type}</Tag>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {change.items.map((item, iIdx) => <li key={iIdx} style={{ color: '#666' }}>{item}</li>)}
                  </ul>
                </div>
              ))
            ) : <Text type="secondary">暂无详细更新说明</Text>
          }))}
        />
      </Modal>
    </Layout>
  );
}

export default MainLayout;