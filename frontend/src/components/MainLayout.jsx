import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Divider, Tag } from 'antd';
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
} from '@ant-design/icons';
import { authService } from '../services/auth';

const { Header, Sider, Content } = Layout;

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const user = authService.getUser();
  const isAdmin = user?.role === 'admin';

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
    </Layout>
  );
}

export default MainLayout;