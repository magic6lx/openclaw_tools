# API密钥配置指南

## 🎯 两种方式任选

### 方式一：使用测试API（快速体验）

适合：初次体验，不想立即注册的用户

**优点：**
- 无需注册，开箱即用
- 免费10次调用额度
- 支持GPT-3.5-turbo模型

**缺点：**
- 有调用次数限制（10次）
- 有Token限制（10000个）
- 24小时后过期

**配置方法：**
```json
{
  "api": {
    "provider": "openai",
    "key": "oc_xxx",
    "secret": "yyy",
    "proxy_url": "http://your-server.com/api/proxy/proxy"
  }
}
```

---

### 方式二：使用自己的API密钥（推荐长期使用）

适合：需要大量使用的用户

**优点：**
- 无调用次数限制
- 使用自己的账户，数据安全
- 支持所有模型（GPT-4等）
- 费用透明，自己控制

**缺点：**
- 需要注册OpenAI账号
- 需要绑定支付方式
- 按使用量付费

**配置方法：**
```json
{
  "api": {
    "provider": "openai",
    "key": "sk-your-own-api-key",
    "base_url": "https://api.openai.com/v1"
  }
}
```

---

## 🔑 如何获取自己的API密钥

### 1. 注册OpenAI账号

1. 访问 https://platform.openai.com
2. 点击 "Sign up" 注册
3. 使用邮箱或Google账号注册
4. 验证手机号（中国大陆手机号可能不支持，可用接码平台）

### 2. 创建API密钥

1. 登录后点击右上角个人头像
2. 选择 "View API keys"
3. 点击 "Create new secret key"
4. 复制生成的密钥（**注意：只显示一次！**）

### 3. 绑定支付方式（可选）

- 新账号有$5免费额度
- 用完后再绑定信用卡
- 绑定路径：Billing → Payment methods

---

## 🔄 从方式一切换到方式二

### 步骤1：获取自己的API密钥
按照上面的步骤注册并获取

### 步骤2：修改配置文件

**原配置（方式一）：**
```json
{
  "api": {
    "provider": "openai",
    "key": "oc_abc123",
    "secret": "xyz789",
    "proxy_url": "http://your-server.com/api/proxy/proxy"
  }
}
```

**新配置（方式二）：**
```json
{
  "api": {
    "provider": "openai",
    "key": "sk-your-own-api-key",
    "base_url": "https://api.openai.com/v1"
  }
}
```

**变化说明：**
- `key`: 从 `oc_xxx` 改为 `sk-xxx`（你的真实密钥）
- 删除 `secret` 字段
- 删除 `proxy_url` 字段
- 添加 `base_url` 字段

### 步骤3：保存并重启

1. 保存配置文件
2. 重启OpenClaw
3. 测试API调用

---

## 💰 费用参考

| 模型 | 输入费用 | 输出费用 |
|------|----------|----------|
| GPT-3.5-turbo | $0.50/1M tokens | $1.50/1M tokens |
| GPT-4 | $30/1M tokens | $60/1M tokens |
| GPT-4-turbo | $10/1M tokens | $30/1M tokens |

**估算：**
- 一次普通对话（约500 tokens）：$0.001-0.003
- 100次对话：$0.1-0.3
- 1000次对话：$1-3

---

## ❓ 常见问题

### Q: 临时密钥用完了怎么办？
A: 可以申请新的临时密钥，或者切换到方式二使用自己的密钥。

### Q: 自己的密钥安全吗？
A: 密钥只存储在您的本地配置文件中，不会上传到任何服务器。

### Q: 支持其他模型吗？
A: 支持！可以配置Claude、Gemini等其他模型：

```json
{
  "api": {
    "provider": "anthropic",
    "key": "sk-ant-xxx",
    "base_url": "https://api.anthropic.com/v1"
  }
}
```

### Q: 如何查看使用情况？
A: 登录 https://platform.openai.com/usage 查看详细账单。

---

## 🆘 需要帮助？

- 遇到问题？查看OpenAI文档：https://platform.openai.com/docs
- 配置问题？参考本文档的示例配置
- 其他问题？联系社区支持
