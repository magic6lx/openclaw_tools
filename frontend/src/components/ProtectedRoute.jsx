import React from 'react';
import { Navigate } from 'react-router-dom';
import { authService } from '../services/auth';

function ProtectedRoute({ children }) {
  const isLauncherMode = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

  if (isLauncherMode) {
    return children;
  }

  const isAuthenticated = authService.isAuthenticated();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;