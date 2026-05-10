import React, { useState, useEffect } from 'react';
import { Card, Steps, Button, Input, Select, Switch, Space, Typography, Alert, Divider, message, Tag, Result, Descriptions, Spin, Row, Col } from 'antd';
import { CheckCircleOutlined, RightOutlined, LinkOutlined, CopyOutlined, QrcodeOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { LAUNCHER_API, launcherFetch } from '../utils/launcher';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const FEISHU_DOCS_URL = 'https://docs.openclaw.ai/zh-CN/channels/feishu';
const FEISHU_OPEN_PLATFORM = 'https://open.feishu.cn/app';

function FeishuSetup({ currentConfig, onConfigSaved }) {
  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [setupMode, setSetupMode] = useState(null);
  const [loginRunning, setLoginRunning] = useState(false);
  const [feishuConfig, setFeishuConfig] = useState({
    enabled: true,
    appId: '',
    appSecret: '',
    dmPolicy: 'allowlist',
    groupPolicy: 'allowlist',
    requireMention: true,
    streaming: true
  });

  useEffect(() => {
    if (currentConfig?.channels?.feishu) {
      const existing = currentConfig.channels.feishu;
      setFeishuConfig(prev => ({
        ...prev,
        enabled: existing.enabled ?? prev.enabled,
        appId: existing.appId || existing.accounts?.main?.appId || '',
        appSecret: existing.appSecret || existing.accounts?.main?.appSecret || '',
        dmPolicy: existing.dmPolicy || prev.dmPolicy,
        groupPolicy: existing.groupPolicy || prev.groupPolicy,
        requireMention: existing.requireMention ?? prev.requireMention,
        streaming: existing.streaming ?? prev.streaming
      }));
    }
  }, [currentConfig]);

  const handleQuickLogin = async () => {
    setLoginRunning(true);
    try {
      const res = await launcherFetch('/api/cli/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'openclaw channels login --channel feishu' })
      });
      const data = await res.json();
      if (data.success) {
        message.success('飞书登录命令已启动，请在弹出的终端窗口中完成操作');
        setCurrent(3);
        if (onConfigSaved) onConfigSaved();
      } else {
        message.error(data.error || '启动登录命令失败');
      }
    } catch (err) {
      message.error(`启动登录命令失败: ${err.message}`);
    }
    setLoginRunning(false);
  };

  const handleSave = async () => {
    if (!feishuConfig.appId.trim()) {
      message.error('请填写 App ID');
      return;
    }
    if (!feishuConfig.appSecret.trim()) {
      message.error('请填写 App Secret');
      return;
    }

    setSaving(true);
    try {
      const newChannels = {
        ...(currentConfig?.channels || {}),
        feishu: {
          enabled: feishuConfig.enabled,
          appId: feishuConfig.appId.trim(),
          appSecret: feishuConfig.appSecret.trim(),
          dmPolicy: feishuConfig.dmPolicy,
          groupPolicy: feishuConfig.groupPolicy,
          requireMention: feishuConfig.requireMention,
          streaming: feishuConfig.streaming
        }
      };

      const partialConfig = {
        ...(currentConfig || {}),
        channels: newChannels
      };

      const res = await launcherFetch('/config/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: partialConfig })
      });
      const data = await res.json();

      if (data.success) {
        message.success('飞书配置已保存');
        setCurrent(3);
        if (onConfigSaved) onConfigSaved();
      } else {
        message.error(data.error || '保存失败');
      }
    } catch (err) {
      message.error(`保存失败: ${err.message}`);
    }
    setSaving(false);
  };

  const steps = [
    {
      title: '选择方式',
      description: '快捷登录或手动配置'
    },
    {
      title: '填写凭证',
      description: '输入 App ID 和 Secret'
    },
    {
      title: '配置策略',
      description: '设置消息和群聊策略'
    },
    {
      title: '完成',
      description: '启动并验证'
    }
  ];

  const renderStep0 = () => (
    <div>
      <Alert
        type="info"
        showIcon
        message="飞书通道配置"
        description={
          <span>
            飞书通道支持两种配置方式。推荐使用快捷登录自动完成配置，或手动填写 App ID 和 App Secret。
            详细配置请参考 <a href={FEISHU_DOCS_URL} target="_blank" rel="noopener noreferrer">飞书通道官方文档</a>。
          </span>
        }
        style={{ marginBottom: 24 }}
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card
            hoverable
            style={{
              borderColor: setupMode === 'quick' ? '#3370ff' : '#d9d9d9',
              background: setupMode === 'quick' ? '#f0f5ff' : '#fff',
              height: '100%'
            }}
            onClick={() => setSetupMode('quick')}
          >
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <QrcodeOutlined style={{ fontSize: 40, color: '#3370ff', marginBottom: 12 }} />
              <Title level={4} style={{ marginBottom: 8 }}>快捷登录</Title>
              <Paragraph type="secondary">
                运行 <Text code>openclaw channels login --channel feishu</Text>，
                扫描二维码自动创建飞书机器人并完成配置
              </Paragraph>
              <Tag color="blue">推荐</Tag>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            hoverable
            style={{
              borderColor: setupMode === 'manual' ? '#3370ff' : '#d9d9d9',
              background: setupMode === 'manual' ? '#f0f5ff' : '#fff',
              height: '100%'
            }}
            onClick={() => setSetupMode('manual')}
          >
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <ThunderboltOutlined style={{ fontSize: 40, color: '#fa8c16', marginBottom: 12 }} />
              <Title level={4} style={{ marginBottom: 8 }}>手动配置</Title>
              <Paragraph type="secondary">
                在飞书开放平台创建应用后，手动填写 App ID 和 App Secret 完成配置
              </Paragraph>
              <Tag color="orange">高级</Tag>
            </div>
          </Card>
        </Col>
      </Row>

      {setupMode === 'quick' && (
        <div>
          <div style={{ background: '#fafafa', padding: 20, borderRadius: 8, marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 16 }}>快捷登录步骤：</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><Tag color="blue">1</Tag> 点击下方按钮启动登录命令</div>
              <div><Tag color="blue">2</Tag> 在弹出的终端窗口中，使用飞书 App 扫描二维码（注意，powershell右键属性调整字体为MS Gothic才能扫码）</div>
              <div><Tag color="blue">3</Tag> 扫码成功后，配置将自动写入 openclaw.json</div>
              <div><Tag color="blue">4</Tag> 重启 Gateway 使配置生效</div>
            </div>
          </div>
          <Alert
            type="warning"
            showIcon
            message="版本要求"
            description="快捷登录需要 OpenClaw 2026.4.25 或以上版本。运行 openclaw --version 检查版本，使用 openclaw update 升级。"
            style={{ marginBottom: 16 }}
          />
          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              icon={<QrcodeOutlined />}
              onClick={handleQuickLogin}
              loading={loginRunning}
            >
              启动快捷登录
            </Button>
          </div>
        </div>
      )}

      {setupMode === 'manual' && (
        <div>
          <div style={{ background: '#fafafa', padding: 20, borderRadius: 8, marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 16 }}>前置操作清单：</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><Tag color="blue">1</Tag> 在 <a href={FEISHU_OPEN_PLATFORM} target="_blank" rel="noopener noreferrer">飞书开放平台</a> 创建自建应用</div>
              <div><Tag color="blue">2</Tag> 开启「机器人」能力</div>
              <div><Tag color="blue">3</Tag> 配置事件订阅：选择 <Text strong>WebSocket</Text> 模式，添加 <Text code>im.message.receive_v1</Text></div>
              <div><Tag color="blue">4</Tag> 添加权限：<Text code>im:message</Text>、<Text code>im:message:send_as_bot</Text>、<Text code>im:resource</Text></div>
              <div><Tag color="blue">5</Tag> 发布应用并等待审批通过</div>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Button type="primary" size="large" onClick={() => setCurrent(1)}>
              已完成前置操作，开始填写凭证 <RightOutlined />
            </Button>
          </div>
        </div>
      )}

      {!setupMode && (
        <div style={{ textAlign: 'center', color: '#999' }}>
          <Text type="secondary">请选择配置方式</Text>
        </div>
      )}
    </div>
  );

  const renderStep1 = () => (
    <div>
      <Alert
        type="info"
        showIcon
        message="填写飞书应用凭证"
        description="在飞书开放平台的应用详情页可以找到 App ID 和 App Secret"
        style={{ marginBottom: 24 }}
      />

      <div style={{ maxWidth: 500 }}>
        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>App ID</Text>
          <Input
            placeholder="cli_xxxxxxxxxxxx"
            value={feishuConfig.appId}
            onChange={e => setFeishuConfig(prev => ({ ...prev, appId: e.target.value }))}
            size="large"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>在飞书开放平台 → 应用详情 → 凭证与基础信息 中获取</Text>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>App Secret</Text>
          <Input.Password
            placeholder="输入 App Secret"
            value={feishuConfig.appSecret}
            onChange={e => setFeishuConfig(prev => ({ ...prev, appSecret: e.target.value }))}
            size="large"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>App Secret 仅显示一次，请妥善保存。如遗忘可在飞书平台重置</Text>
        </div>
      </div>

      <Divider />

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => setCurrent(0)}>上一步</Button>
        <Button
          type="primary"
          onClick={() => {
            if (!feishuConfig.appId.trim()) {
              message.warning('请填写 App ID');
              return;
            }
            if (!feishuConfig.appSecret.trim()) {
              message.warning('请填写 App Secret');
              return;
            }
            setCurrent(2);
          }}
        >
          下一步 <RightOutlined />
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <Alert
        type="info"
        showIcon
        message="配置消息策略"
        description="根据你的使用场景选择合适的消息和群聊策略"
        style={{ marginBottom: 24 }}
      />

      <div style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>启用飞书频道</Text>
          <Switch
            checked={feishuConfig.enabled}
            onChange={checked => setFeishuConfig(prev => ({ ...prev, enabled: checked }))}
            checkedChildren="启用"
            unCheckedChildren="关闭"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>私信策略 (dmPolicy)</Text>
          <Select
            value={feishuConfig.dmPolicy}
            onChange={value => setFeishuConfig(prev => ({ ...prev, dmPolicy: value }))}
            style={{ width: '100%' }}
            size="large"
          >
            <Option value="allowlist">
              <Space>
                <Tag color="blue">推荐</Tag>
                白名单模式 — 仅允许指定用户私聊
              </Space>
            </Option>
            <Option value="pairing">
              配对模式 — 未知用户需审批后可私聊
            </Option>
            <Option value="open">
              开放模式 — 所有人可私聊
            </Option>
            <Option value="disabled">
              禁用私信
            </Option>
          </Select>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {feishuConfig.dmPolicy === 'allowlist' && '仅机器人所有者可以私聊，最安全'}
            {feishuConfig.dmPolicy === 'pairing' && '用户首次私聊会收到配对码，需通过 openclaw pairing approve 审批'}
            {feishuConfig.dmPolicy === 'open' && '任何人都可以私聊机器人，请确保模型输出安全'}
            {feishuConfig.dmPolicy === 'disabled' && '不允许任何人私聊'}
          </Text>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>群聊策略 (groupPolicy)</Text>
          <Select
            value={feishuConfig.groupPolicy}
            onChange={value => setFeishuConfig(prev => ({ ...prev, groupPolicy: value }))}
            style={{ width: '100%' }}
            size="large"
          >
            <Option value="allowlist">
              <Space>
                <Tag color="blue">推荐</Tag>
                白名单模式 — 仅响应指定群
              </Space>
            </Option>
            <Option value="open">
              开放模式 — 响应所有群消息
            </Option>
            <Option value="disabled">
              禁用群聊
            </Option>
          </Select>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {feishuConfig.groupPolicy === 'allowlist' && '需要手动添加群组 ID 到配置中'}
            {feishuConfig.groupPolicy === 'open' && '机器人被加入的任何群都会响应'}
            {feishuConfig.groupPolicy === 'disabled' && '不在任何群中响应'}
          </Text>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>需要 @提及 才响应</Text>
          <Switch
            checked={feishuConfig.requireMention}
            onChange={checked => setFeishuConfig(prev => ({ ...prev, requireMention: checked }))}
            checkedChildren="是"
            unCheckedChildren="否"
          />
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>开启后，群聊中需要 @机器人 才会响应消息</Text>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>流式回复</Text>
          <Switch
            checked={feishuConfig.streaming}
            onChange={checked => setFeishuConfig(prev => ({ ...prev, streaming: checked }))}
            checkedChildren="启用"
            unCheckedChildren="关闭"
          />
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>启用后，机器人会实时更新消息卡片，逐字显示回复内容</Text>
        </div>
      </div>

      <Divider />

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => setCurrent(1)}>上一步</Button>
        <Button type="primary" onClick={handleSave} loading={saving}>
          保存配置 <CheckCircleOutlined />
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <Result
        status="success"
        title="飞书配置完成！"
        subTitle="配置已保存到本地 openclaw.json，请重启 Gateway 使配置生效"
        extra={[
          <div key="info" style={{ textAlign: 'left', maxWidth: 500, margin: '0 auto' }}>
            <Descriptions bordered size="small" column={1} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="App ID">{feishuConfig.appId}</Descriptions.Item>
              <Descriptions.Item label="私信策略">
                <Tag color="blue">{feishuConfig.dmPolicy}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="群聊策略">
                <Tag color="blue">{feishuConfig.groupPolicy}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="@提及响应">
                {feishuConfig.requireMention ? '是' : '否'}
              </Descriptions.Item>
              <Descriptions.Item label="流式回复">
                {feishuConfig.streaming ? '启用' : '关闭'}
              </Descriptions.Item>
            </Descriptions>

            <Alert
              type="info"
              message="后续操作"
              description={
                <ol style={{ margin: 0, paddingLeft: 16 }}>
                  <li>前往「日常运营」页面重启 Gateway 服务</li>
                  <li>在飞书中找到你的机器人，发送一条消息测试</li>
                  <li>如需审批配对请求，使用命令：<Text code>openclaw pairing approve feishu {'<CODE>'}</Text></li>
                  <li>如需添加群组白名单，在配置文件中添加群组 ID（格式：oc_xxx）</li>
                </ol>
              }
              style={{ marginBottom: 16 }}
            />

            <Alert
              type="warning"
              message="获取群组/用户 ID"
              description={
                <div>
                  <Text type="secondary">群组 ID（oc_xxx）：在飞书群设置中查看</Text>
                  <br />
                  <Text type="secondary">用户 ID（ou_xxx）：向机器人发私信后，使用 <Text code>openclaw logs --follow</Text> 查看日志获取</Text>
                </div>
              }
            />
          </div>,
          <Space key="actions" style={{ marginTop: 16 }}>
            <Button onClick={() => setCurrent(0)}>重新配置</Button>
            <Button type="primary" onClick={() => window.open(FEISHU_DOCS_URL, '_blank')}>
              查看飞书文档 <LinkOutlined />
            </Button>
          </Space>
        ]}
      />
    </div>
  );

  const renderStepContent = () => {
    switch (current) {
      case 0: return renderStep0();
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      default: return null;
    }
  };

  const existingFeishu = currentConfig?.channels?.feishu;
  const isConfigured = existingFeishu?.appId;

  return (
    <Card
      style={{ marginBottom: 16, borderColor: '#3370ff' }}
      title={
        <Space>
          <span style={{ fontSize: 20 }}>🐦</span>
          <Text strong style={{ fontSize: 16 }}>飞书快捷配置</Text>
          {isConfigured && <Tag color="green">已配置</Tag>}
          {!isConfigured && <Tag color="orange">未配置</Tag>}
        </Space>
      }
      extra={
        <a href={FEISHU_DOCS_URL} target="_blank" rel="noopener noreferrer">
          <LinkOutlined /> 官方文档
        </a>
      }
    >
      <Steps current={current} items={steps} style={{ marginBottom: 32 }} onChange={setCurrent} />

      {renderStepContent()}
    </Card>
  );
}

export default FeishuSetup;