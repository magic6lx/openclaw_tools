import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout, Spin } from 'antd';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ConfigWizard from './pages/ConfigWizard';
import LogManagement from './pages/LogManagement';
import TemplateManagement from './pages/TemplateManagement';
import InvitationCodeManagement from './pages/InvitationCodeManagement';
import UserManagement from './pages/UserManagement';
import OpenClawInstall from './pages/OpenClawInstall';
import RuntimeMonitor from './pages/RuntimeMonitor';
import ClientMonitor from './pages/ClientMonitor';
import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { LauncherProvider, useLauncher } from './services/LauncherProvider';
import LauncherBlocker from './services/LauncherBlocker';

const { Content } = Layout;

const MainRoutes = () => {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="wizard" element={<ConfigWizard />} />
            <Route path="logs" element={<LogManagement />} />
            <Route path="templates" element={<TemplateManagement />} />
            <Route path="invitation-codes" element={<InvitationCodeManagement />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="openclaw-install" element={<OpenClawInstall />} />
            <Route path="runtime-monitor" element={<RuntimeMonitor />} />
            <Route path="client-monitor" element={<ClientMonitor />} />
          </Route>
        </Routes>
      </Content>
    </Layout>
  );
};

function App() {
  return (
    <LauncherProvider>
      <AppRoutes />
    </LauncherProvider>
  );
}

const AppRoutes = () => {
  const location = useLocation();
  const { isLauncherReady, loading } = useLauncher();

  const isLoginPage = location.pathname === '/login';

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#f5f5f5'
      }}>
        <Spin size="large" tip="检查 Launcher 状态..." />
      </div>
    );
  }

  if (!isLauncherReady) {
    return <LauncherBlocker />;
  }

  if (isLoginPage) {
    return <Login />;
  }

  return <MainRoutes />;
};

export default App;
