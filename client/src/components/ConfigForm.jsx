import React, { useState } from 'react';
import { Card, Row, Col, Typography, Switch, Select, InputNumber, Input, Space, Collapse, Tag, Alert, Tooltip, Button } from 'antd';
import { InfoCircleOutlined, WarningOutlined, LockOutlined } from '@ant-design/icons';
import { CONFIG_SCHEMA, SECTION_META, validateConfigValue } from '../config/schema';

const { Title, Text } = Typography;
const { Panel } = Collapse;

function SchemaField({ path, schema, value, onChange, disabled, level = 0 }) {
  const [localValue, setLocalValue] = useState(value ?? schema.default);
  
  const handleChange = (newValue) => {
    setLocalValue(newValue);
    onChange?.(path, newValue);
  };

  const isSensitive = schema.sensitive;
  const isDangerous = schema.dangerous;
  
  const label = (
    <Space>
      <span>{schema.title || path[path.length - 1]}</span>
      {isSensitive && (
        <Tooltip title="敏感信息">
          <LockOutlined style={{ color: '#faad14' }} />
        </Tooltip>
      )}
      {isDangerous && (
        <Tooltip title="危险配置">
          <WarningOutlined style={{ color: '#ff4d4f' }} />
        </Tooltip>
      )}
    </Space>
  );

  const renderField = () => {
    if (schema.enum) {
      return (
        <Select
          value={localValue}
          onChange={handleChange}
          disabled={disabled}
          style={{ width: '100%', maxWidth: 300 }}
        >
          {schema.enum.map(v => (
            <Select.Option key={v} value={v}>{v}</Select.Option>
          ))}
        </Select>
      );
    }

    switch (schema.type) {
      case 'boolean':
        return (
          <Switch
            checked={localValue}
            onChange={handleChange}
            disabled={disabled}
          />
        );
      case 'integer':
        return (
          <InputNumber
            value={localValue}
            onChange={handleChange}
            disabled={disabled}
            min={schema.minimum}
            max={schema.maximum}
            style={{ width: '100%', maxWidth: 300 }}
          />
        );
      case 'string':
        return (
          <Input
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={disabled}
            type={isSensitive ? 'password' : 'text'}
            placeholder={schema.default?.toString()}
            style={{ width: '100%', maxWidth: 300 }}
          />
        );
      case 'array':
        if (schema.items?.type === 'object' && schema.items.properties) {
          const arr = Array.isArray(localValue) ? localValue : [];
          return (
            <div style={{ width: '100%', maxWidth: 400 }}>
              {arr.map((item, idx) => (
                <Card
                  key={idx}
                  size="small"
                  style={{ marginBottom: 8, background: '#fafafa' }}
                  title={<Text strong>{item.name || item.id || `项 ${idx + 1}`}</Text>}
                  extra={
                    <Button
                      size="small"
                      danger
                      onClick={() => {
                        const newArr = arr.filter((_, i) => i !== idx);
                        handleChange(newArr);
                      }}
                    >
                      删除
                    </Button>
                  }
                >
                  {Object.entries(schema.items.properties).map(([field, fieldSchema]) => (
                    <div key={field} style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>{fieldSchema.title || field}: </Text>
                      {fieldSchema.enum ? (
                        <Select
                          size="small"
                          value={item[field]}
                          style={{ width: 120 }}
                          onChange={(val) => {
                            const newArr = [...arr];
                            newArr[idx] = { ...newArr[idx], [field]: val };
                            handleChange(newArr);
                          }}
                        >
                          {fieldSchema.enum.map(v => (
                            <Select.Option key={v} value={v}>{v}</Select.Option>
                          ))}
                        </Select>
                      ) : fieldSchema.type === 'boolean' ? (
                        <Switch
                          size="small"
                          checked={item[field]}
                          onChange={(val) => {
                            const newArr = [...arr];
                            newArr[idx] = { ...newArr[idx], [field]: val };
                            handleChange(newArr);
                          }}
                        />
                      ) : (
                        <Input
                          size="small"
                          value={item[field] ?? ''}
                          onChange={(e) => {
                            const newArr = [...arr];
                            newArr[idx] = { ...newArr[idx], [field]: e.target.value };
                            handleChange(newArr);
                          }}
                          style={{ width: 120 }}
                        />
                      )}
                    </div>
                  ))}
                </Card>
              ))}
              <Button
                size="small"
                onClick={() => {
                  const newItem = {};
                  Object.entries(schema.items.properties).forEach(([field, fieldSchema]) => {
                    newItem[field] = fieldSchema.default ?? (fieldSchema.type === 'boolean' ? false : '');
                  });
                  handleChange([...arr, newItem]);
                }}
              >
                + 添加
              </Button>
            </div>
          );
        }
        return (
          <Input
            value={Array.isArray(localValue) ? localValue.join(', ') : ''}
            onChange={(e) => {
              const arr = e.target.value.split(',').map(s => s.trim()).filter(s => s);
              handleChange(arr);
            }}
            disabled={disabled}
            placeholder="逗号分隔"
            style={{ width: '100%', maxWidth: 300 }}
          />
        );
      default:
        return <Text type="secondary">{JSON.stringify(localValue)}</Text>;
    }
  };

  return (
    <Row justify="space-between" align="middle" style={{ marginBottom: 12, padding: '8px 0' }}>
      <Col flex="auto" style={{ paddingRight: 16 }}>
        <Space direction="vertical" size={0}>
          {label}
          {schema.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {schema.description}
            </Text>
          )}
        </Space>
      </Col>
      <Col>{renderField()}</Col>
    </Row>
  );
}

function NestedObject({ path, schema, value, onChange, disabled, level = 0 }) {
  const properties = schema.properties || {};

  if (Object.keys(properties).length === 0) {
    if (value && typeof value === 'object' && Object.keys(value).length > 0) {
      return (
        <Card size="small" style={{ marginBottom: 12, background: '#fffbe6' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            当前值: <pre style={{ margin: '4px 0', fontSize: 11 }}>{JSON.stringify(value, null, 2)}</pre>
          </Text>
        </Card>
      );
    }
    return null;
  }

  return (
    <div style={{ marginLeft: level > 0 ? 16 : 0 }}>
      {Object.entries(properties).map(([key, fieldSchema]) => {
        const currentPath = [...path, key];
        const fieldValue = value?.[key];
        
        if (fieldSchema.type === 'object' && fieldSchema.properties) {
          return (
            <Card
              key={key}
              size="small"
              title={
                <Space>
                  <span>{fieldSchema.title || key}</span>
                  {fieldSchema.description && (
                    <Tooltip title={fieldSchema.description}>
                      <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                    </Tooltip>
                  )}
                </Space>
              }
              style={{ marginBottom: 12 }}
            >
              <NestedObject
                path={currentPath}
                schema={fieldSchema}
                value={fieldValue}
                onChange={onChange}
                disabled={disabled}
                level={level + 1}
              />
            </Card>
          );
        }
        
        return (
          <SchemaField
            key={key}
            path={currentPath}
            schema={fieldSchema}
            value={fieldValue}
            onChange={onChange}
            disabled={disabled}
            level={level}
          />
        );
      })}
    </div>
  );
}

function ConfigSection({ section, schema, meta, config, onConfigChange, disabled }) {
  const handleChange = (path, value) => {
    const newConfig = { ...config };
    let current = newConfig;
    
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = value;
    onConfigChange?.(section, newConfig);
  };

  const categoryColor = {
    '基础': '#1890ff',
    '核心': '#52c41a',
    '扩展': '#722ed1',
    '集成': '#fa8c16',
    '自动化': '#13c2c2',
    '安全': '#f5222d',
    '企业': '#eb2f96',
    '元信息': '#8c8c8c',
    '日志': '#faad14',
    '浏览器': '#13c2c2',
    '模型': '#eb2f96',
    '技能': '#52c41a',
    '频道': '#1890ff',
    '画布': '#722ed1',
    '沙箱': '#fa8c16'
  };

  return (
    <Card 
      title={
        <Space>
          <span style={{ fontSize: 18 }}>{meta?.icon}</span>
          <span>{schema.title || section}</span>
          {meta?.category && (
            <Tag color={categoryColor[meta.category] || '#8c8c8c'}>
              {meta.category}
            </Tag>
          )}
        </Space>
      }
      extra={
        schema.description && (
          <Tooltip title={schema.description}>
            <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
          </Tooltip>
        )
      }
      style={{ marginBottom: 16 }}
    >
      <NestedObject
        path={[section]}
        schema={schema}
        value={config}
        onChange={handleChange}
        disabled={disabled}
      />
    </Card>
  );
}

export default function ConfigForm({ config, onConfigChange, disabled, activeSections }) {
  const sections = CONFIG_SCHEMA.properties;
  const sortedSections = Object.entries(sections)
    .sort(([a], [b]) => {
      const orderA = SECTION_META[a]?.order || 999;
      const orderB = SECTION_META[b]?.order || 999;
      return orderA - orderB;
    });

  const filteredSections = activeSections 
    ? sortedSections.filter(([section]) => activeSections.includes(section))
    : sortedSections;

  return (
    <div>
      {filteredSections.map(([section, schema]) => (
        <ConfigSection
          key={section}
          section={section}
          schema={schema}
          meta={SECTION_META[section]}
          config={config?.[section]}
          onConfigChange={onConfigChange}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
