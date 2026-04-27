import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Install from './pages/Install';
import Operations from './pages/Operations';
import Config from './pages/Config';
import FeishuChannel from './pages/FeishuChannel';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Login from './pages/Login';
import Templates from './pages/admin/Templates';
import Logs from './pages/admin/Logs';
import Invitations from './pages/admin/Invitations';
import Statistics from './pages/admin/Statistics';
import LauncherDiagnostics from './pages/LauncherDiagnostics';
import MainLayout from './layouts/MainLayout';
import { LoadingOutlined } from '@ant-design/icons';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <LoadingOutlined style={{ fontSize: 48 }} />
    </div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <LoadingOutlined style={{ fontSize: 48 }} />
    </div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<Navigate to={isAdmin ? '/admin/templates' : '/home'} />} />
      
      <Route path="/home" element={<ProtectedRoute><MainLayout><Home /></MainLayout></ProtectedRoute>} />
      <Route path="/install" element={<ProtectedRoute><MainLayout><Install /></MainLayout></ProtectedRoute>} />
      <Route path="/operations" element={<ProtectedRoute><MainLayout><Operations /></MainLayout></ProtectedRoute>} />
       <Route path="/dashboard" element={<AdminRoute><MainLayout><Dashboard /></MainLayout></AdminRoute>} />
      <Route path="/config" element={<ProtectedRoute><MainLayout><Config /></MainLayout></ProtectedRoute>} />
      <Route path="/feishu" element={<ProtectedRoute><MainLayout><FeishuChannel /></MainLayout></ProtectedRoute>} />
      
     
      <Route path="/clients" element={<AdminRoute><MainLayout><Clients /></MainLayout></AdminRoute>} />
      <Route path="/admin/templates" element={<AdminRoute><MainLayout><Templates /></MainLayout></AdminRoute>} />
      <Route path="/admin/logs" element={<AdminRoute><MainLayout><Logs /></MainLayout></AdminRoute>} />
      <Route path="/admin/invitations" element={<AdminRoute><MainLayout><Invitations /></MainLayout></AdminRoute>} />
      <Route path="/admin/statistics" element={<AdminRoute><MainLayout><Statistics /></MainLayout></AdminRoute>} />
      <Route path="/diagnostics" element={<ProtectedRoute><MainLayout><LauncherDiagnostics /></MainLayout></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
