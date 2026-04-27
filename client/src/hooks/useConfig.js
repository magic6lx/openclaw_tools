import { useState, useEffect, useCallback } from 'react';
import { CONFIG_SCHEMA } from '../config/schema';

const LAUNCHER_API = 'http://127.0.0.1:3003';
const SERVER_API = 'http://127.0.0.1:3002';

export function getDefaultConfig() {
  const defaults = {};

  function extractDefaults(schema, current = {}) {
    if (!schema || typeof schema !== 'object') return current;

    if (schema.default !== undefined) {
      return schema.default;
    }

    if (schema.type === 'object' && schema.properties) {
      const obj = {};
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        obj[key] = extractDefaults(propSchema);
      }
      return obj;
    }

    if (schema.type === 'array' && schema.default !== undefined) {
      return schema.default;
    }

    return current;
  }

  for (const [section, sectionSchema] of Object.entries(CONFIG_SCHEMA.properties)) {
    defaults[section] = extractDefaults(sectionSchema);
  }

  return defaults;
}

export function mergeWithDefaults(config) {
  if (!config || typeof config !== 'object') {
    return getDefaultConfig();
  }

  const defaults = getDefaultConfig();
  const merged = { ...defaults };

  for (const [section, sectionValue] of Object.entries(config)) {
    if (sectionValue && typeof sectionValue === 'object' && !Array.isArray(sectionValue)) {
      merged[section] = {
        ...(defaults[section] || {}),
        ...sectionValue
      };
    } else if (Array.isArray(sectionValue)) {
      if (defaults[section] && defaults[section].list !== undefined) {
        merged[section] = {
          ...(defaults[section] || {}),
          list: sectionValue
        };
      } else {
        merged[section] = sectionValue;
      }
    } else {
      merged[section] = sectionValue;
    }
  }

  return merged;
}

export function useConfig() {
  const [config, setConfig] = useState(null);
  const [env, setEnv] = useState(null);
  const [source, setSource] = useState(null);
  const [configPath, setConfigPath] = useState(null);
  const [envPath, setEnvPath] = useState(null);
  const [keyPaths, setKeyPaths] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchConfigFromServer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${SERVER_API}/api/config/server`, { headers });
      const data = await res.json();
      if (data.success) {
        const configData = data.data?.config || data.data;
        const mergedConfig = mergeWithDefaults(configData);
        setConfig(mergedConfig);
        setConfigPath(data.path || null);
        setSource('server');
        setEnv(null);
        setEnvPath(null);
        setKeyPaths({});
      } else {
        setError(data.message || '获取配置失败');
      }
    } catch (err) {
      setError(`无法连接服务器: ${err.message}`);
    }
    setLoading(false);
  }, []);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${LAUNCHER_API}/config/export`);
      const data = await res.json();
      if (data.success) {
        const configData = data.config?.config || data.data?.config || data.config;
        const mergedConfig = mergeWithDefaults(configData);
        setConfig(mergedConfig);
        setEnv(data.env || null);
        setSource(data.source || 'unknown');
        setConfigPath(data.configPath || null);
        setEnvPath(data.envPath || null);
        setKeyPaths(data.keyPaths || {});
      } else {
        setError(data.message || '获取配置失败');
      }
    } catch (err) {
      setError(`无法连接 Launcher: ${err.message}`);
    }
    setLoading(false);
  }, []);

  const updateConfig = useCallback((section, newSectionConfig) => {
    setConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: newSectionConfig
      };
    });
  }, []);

  const getRawConfig = useCallback(() => {
    if (!config) return null;
    const raw = {};
    for (const [section, sectionValue] of Object.entries(config)) {
      const defaults = getDefaultConfig();
      const sectionDefaults = defaults[section] || {};
      const sectionRaw = {};

      for (const [key, value] of Object.entries(sectionValue || {})) {
        if (JSON.stringify(value) !== JSON.stringify(sectionDefaults[key])) {
          sectionRaw[key] = value;
        }
      }

      if (Object.keys(sectionRaw).length > 0) {
        raw[section] = sectionRaw;
      }
    }
    return raw;
  }, [config]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

const saveConfig = useCallback(async (configToSave) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${SERVER_API}/api/config/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ config: configToSave })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  return {
    config,
    setConfig,
    env,
    source,
    configPath,
    envPath,
    keyPaths,
    loading,
    error,
    fetchConfig,
    fetchConfigFromServer,
    updateConfig,
    getRawConfig,
    saveConfig
  };
}

export default useConfig;