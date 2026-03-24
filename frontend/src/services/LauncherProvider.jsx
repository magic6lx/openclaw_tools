import React, { useState, useEffect, createContext, useContext } from 'react';
import { Spin, message } from 'antd';
import localLauncherService from '../services/localLauncherService';

export const LauncherContext = createContext({
  launcherStatus: null,
  isLauncherReady: false,
  refreshLauncherStatus: () => {}
});

export const useLauncher = () => useContext(LauncherContext);

export const LauncherProvider = ({ children }) => {
  const [launcherStatus, setLauncherStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkLauncher = async () => {
    setLoading(true);
    try {
      const status = await localLauncherService.checkOpenClawStatus();
      setLauncherStatus(status);
      return status;
    } catch (error) {
      setLauncherStatus({
        available: false,
        error: error.message,
        installed: false,
        gatewayRunning: false
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkLauncher();
  }, []);

  return (
    <LauncherContext.Provider value={{
      launcherStatus,
      isLauncherReady: launcherStatus?.available === true,
      refreshLauncherStatus: checkLauncher,
      loading
    }}>
      {children}
    </LauncherContext.Provider>
  );
};

export default LauncherProvider;
