import React from 'react';
import { Typography } from 'antd';
import FeishuSetup from '../components/FeishuSetup';
import { useConfig } from '../hooks/useConfig';

const { Title, Text, Paragraph } = Typography;

function FeishuChannel() {
  const {
    config: localConfig,
    fetchConfig
  } = useConfig();

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={3} style={{ marginBottom: 4 }}>🐦 飞书消息通道配置</Title>
        <Paragraph type="secondary">
          配置飞书机器人，让你的 OpenClaw 通过飞书与用户交互。支持快捷扫码配置和手动配置两种方式。
        </Paragraph>
      </div>

      <FeishuSetup
        currentConfig={localConfig}
        onConfigSaved={() => fetchConfig()}
      />
    </div>
  );
}

export default FeishuChannel;