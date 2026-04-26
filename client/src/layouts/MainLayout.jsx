import React, { useState } from 'react';
import { Layout, Menu, Button, theme, Typography, Dropdown, Space } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  SettingOutlined,
  TeamOutlined,
  FileTextOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  KeyOutlined,
  DesktopOutlined,
  DownloadOutlined,
  ToolOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const MainLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const isAdmin = user?.role === 'admin';

  // 普通用户菜单
  const userMenuItems = [
    {
      key: '/home',
      icon: <DashboardOutlined />,
      label: '工作台',
    },
    {
      key: '/install',
      icon: <DownloadOutlined />,
      label: '安装部署',
    },
    {
      key: '/operations',
      icon: <ToolOutlined />,
      label: '运维工具',
    },
    {
      key: '/config',
      icon: <SettingOutlined />,
      label: '配置管理',
    },
  ];

  // 管理员菜单
  const adminMenuItems = [
    {
      key: '/home',
      icon: <DashboardOutlined />,
      label: '工作台',
    },
    {
      key: '/dashboard',
      icon: <AppstoreOutlined />,
      label: '总览面板',
    },
    {
      key: '/admin/templates',
      icon: <AppstoreOutlined />,
      label: '模板配置',
    },
    {
      key: '/clients',
      icon: <DesktopOutlined />,
      label: '客户端管理',
    },
    {
      key: '/admin/invitations',
      icon: <KeyOutlined />,
      label: '邀请码管理',
    },
    {
      key: '/admin/logs',
      icon: <FileTextOutlined />,
      label: '系统日志',
    },
    {
      key: '/admin/statistics',
      icon: <BarChartOutlined />,
      label: '数据统计',
    },
  ];

  const menuItems = isAdmin ? adminMenuItems : userMenuItems;

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userDropdownItems = [
    {
      key: 'role',
      label: <Text type="secondary">角色: {isAdmin ? '管理员' : '普通用户'}</Text>,
      disabled: true,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           {!collapsed && <span style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>OpenClaw Tools</span>}
           {collapsed && <span style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>OC</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            boxShadow: '0 1px 4px rgba(0,21,41,.08)',
            zIndex: 1
          }}
        >
          <Dropdown menu={{ items: userDropdownItems }} placement="bottomRight">
            <Button type="text" style={{ display: 'flex', alignItems: 'center' }}>
              <Space>
                <UserOutlined />
                {user?.code}
              </Space>
            </Button>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            overflow: 'auto'
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;