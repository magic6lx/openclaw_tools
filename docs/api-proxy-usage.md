# API代理服务使用指南

## 概述

API代理服务用于安全地转发AI模型API请求，保护真实的API密钥不被泄露。

## 核心特性

- **临时密钥**: 为每个用户生成独立的临时API密钥
- **配额控制**: 限制请求次数和Token使用量
- **模型白名单**: 只允许使用指定的模型
- **过期时间**: 密钥自动过期，防止长期滥用
- **使用监控**: 记录所有API调用，便于审计

## 使用流程

### 1. 创建临时API密钥

当用户导入配置模板时，系统自动为其生成临时API密钥：

```javascript
POST /api/proxy/create-temp-key
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "templateId": 1,
  "options": {
    "maxRequests": 10,           // 最多10次请求
    "maxTokens": 10000,          // 最多10000个token
    "expiresInHours": 24,        // 24小时后过期
    "allowedModels": ["gpt-3.5-turbo"]  // 只允许使用gpt-3.5-turbo
  }
}
```

响应：
```json
{
  "success": true,
  "data": {
    "keyId": "oc_abc123",
    "secretKey": "xyz789",
    "expiresAt": "2024-01-20T12:00:00Z",
    "maxRequests": 10,
    "maxTokens": 10000
  }
}
```

### 2. 使用临时密钥调用API

用户配置文件中存储的是临时密钥，而不是真实的API密钥：

```javascript
POST /api/proxy/proxy
Content-Type: application/json

{
  "keyId": "oc_abc123",
  "secretKey": "xyz789",
  "provider": "openai",
  "endpoint": "/chat/completions",
  "requestBody": {
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }
}
```

响应：
```json
{
  "success": true,
  "data": {
    "id": "chatcmpl-xxx",
    "choices": [...]
  },
  "usage": {
    "requestsUsed": 1,
    "requestsLimit": 10,
    "tokensUsed": 150,
    "tokensLimit": 10000
  }
}
```

### 3. 查询使用情况

```javascript
GET /api/proxy/usage/oc_abc123
```

响应：
```json
{
  "success": true,
  "data": {
    "keyId": "oc_abc123",
    "status": "active",
    "quota": {
      "requests": {
        "used": 5,
        "limit": 10,
        "remaining": 5
      },
      "tokens": {
        "used": 5000,
        "limit": 10000,
        "remaining": 5000
      }
    },
    "expiresAt": "2024-01-20T12:00:00Z"
  }
}
```

### 4. 吊销密钥

如果发现有滥用行为，可以立即吊销密钥：

```javascript
POST /api/proxy/revoke/oc_abc123
Authorization: Bearer <admin_token>
```

## 安全建议

1. **设置合理的配额**: 根据测试需求设置请求次数和Token限制
2. **限制模型**: 只允许使用必要的模型，避免使用昂贵的GPT-4
3. **短期过期**: 建议设置24-48小时的过期时间
4. **监控使用**: 定期检查API使用情况，发现异常及时处理
5. **环境变量**: 将真实的API密钥存储在环境变量中，不要硬编码

## 环境变量配置

在 `.env` 文件中配置真实的API密钥：

```env
OPENAI_API_KEY=sk-your-real-openai-key
ANTHROPIC_API_KEY=sk-ant-your-real-anthropic-key
```

## 前端集成示例

```javascript
// 1. 获取临时密钥
const tempKey = await fetch('/api/proxy/create-temp-key', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    templateId: 1,
    options: { maxRequests: 10, maxTokens: 10000 }
  })
});

// 2. 将临时密钥写入用户配置
const userConfig = {
  ...templateConfig,
  api_key: tempKey.data.keyId,
  api_secret: tempKey.data.secretKey,
  api_proxy_url: 'http://localhost:3000/api/proxy/proxy'
};

// 3. 调用API时通过代理
const response = await fetch('http://localhost:3000/api/proxy/proxy', {
  method: 'POST',
  body: JSON.stringify({
    keyId: userConfig.api_key,
    secretKey: userConfig.api_secret,
    provider: 'openai',
    endpoint: '/chat/completions',
    requestBody: {
      model: 'gpt-3.5-turbo',
      messages: messages
    }
  })
});
```

## 注意事项

1. 临时密钥只能用于测试，不能用于生产环境
2. 用户应该尽快替换为自己的API密钥
3. 定期清理过期的密钥记录
4. 监控异常使用模式，防止滥用
