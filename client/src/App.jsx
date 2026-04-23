import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Install from './pages/Install';
import Operations from './pages/Operations';
import Config from './pages/Config';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Login from './pages/Login';
import Templates from './pages/admin/Templates';
import Logs from './pages/admin/Logs';
import Invitations from './pages/admin/Invitations';
import Statistics from './pages/admin/Statistics';
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
      
      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/install" element={<ProtectedRoute><Install /></ProtectedRoute>} />
      <Route path="/operations" element={<ProtectedRoute><Operations /></ProtectedRoute>} />
      <Route path="/config" element={<ProtectedRoute><Config /></ProtectedRoute>} />
      
      <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
      <Route path="/clients" element={<AdminRoute><Clients /></AdminRoute>} />
      <Route path="/admin/templates" element={<AdminRoute><Templates /></AdminRoute>} />
      <Route path="/admin/logs" element={<AdminRoute><Logs /></AdminRoute>} />
      <Route path="/admin/invitations" element={<AdminRoute><Invitations /></AdminRoute>} />
      <Route path="/admin/statistics" element={<AdminRoute><Statistics /></AdminRoute>} />
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
