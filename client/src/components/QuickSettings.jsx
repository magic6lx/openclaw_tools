import React from 'react';
import { Card, Typography, Button, Space } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import ConfigForm from './ConfigForm';
import { getDefaultConfig } from '../config/presets';

const { Title, Text } = Typography;

export default function QuickSettings({ config, onConfigChange, disabled }) {
  const handleReset = () => {
    const defaultConfig = getDefaultConfig();
    Object.entries(defaultConfig).forEach(([section, fields]) => {
      Object.entries(fields).forEach(([field, value]) => {
        onConfigChange?.(section, field, value);
      });
    });
  };

  return (
    <div>
      <Card
        title={
          <span>
            <FileTextOutlined style={{ marginRight: 8 }} />
            配置项
          </span>
        }
        extra={
          <Button size="small" onClick={handleReset} disabled={disabled}>
            恢复默认
          </Button>
        }
      >
        <ConfigForm
          config={config}
          onConfigChange={onConfigChange}
          disabled={disabled}
        />
      </Card>
    </div>
  );
}
