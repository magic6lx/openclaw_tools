# OpenClaw配置文件格式说明

## 配置文件格式

配置文件采用 **JSON** 格式，必须是一个有效的JSON对象。

## 基本结构

```json
{
  "name": "配置名称",
  "version": "版本号",
  "description": "配置描述",
  "timeout": 30000,
  "max_retries": 3,
  "memory_limit": 2147483648,
  "cpu_limit": 0.8,
  "enable_logging": true,
  "log_level": "info",
  "api_key": "your_api_key",
  "enable_ssl": true,
  "debug_mode": false
}
```

## 字段说明

### 基本配置

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|--------|----------|------|
| `name` | string | 是 | - | 配置名称 |
| `version` | string | 是 | - | 配置版本号 |
| `description` | string | 否 | - | 配置描述 |
| `timeout` | number | 否 | 30000 | 超时时间（毫秒），范围：0-3600000 |
| `max_retries` | number | 否 | 3 | 最大重试次数，范围：0-10 |
| `memory_limit` | number | 否 | - | 内存限制（字节），建议不超过8GB |
| `cpu_limit` | number | 否 | - | CPU使用限制，范围：0-1.0 |

### 日志配置

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|--------|----------|------|
| `enable_logging` | boolean | 否 | false | 是否启用日志 |
| `log_level` | string | 否 | "info" | 日志级别：debug、info、warn、error |

### 安全配置

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|--------|----------|------|
| `api_key` | string | 否 | - | API密钥，建议长度≥16 |
| `enable_ssl` | boolean | 否 | true | 是否启用SSL |
| `debug_mode` | boolean | 否 | false | 是否启用调试模式（生产环境应关闭） |
| `allow_cors` | string | 否 | - | CORS配置，不建议使用"*" |

### 系统要求

```json
"requirements": {
  "min_memory": 2,
  "min_cpu_cores": 2,
  "min_disk_space": 10
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `min_memory` | number | 最小内存要求（GB） |
| `min_cpu_cores` | number | 最小CPU核心数 |
| `min_disk_space` | number | 最小磁盘空间（GB） |

### 操作系统特定配置

```json
"os_specific": {
  "Windows": {
    "service_name": "OpenClawService",
    "install_path": "C:\\Program Files\\OpenClaw",
    "auto_start": true
  },
  "macOS": {
    "service_name": "com.openclaw.service",
    "install_path": "/Applications/OpenClaw.app",
    "auto_start": true
  },
  "Linux": {
    "service_name": "openclaw",
    "install_path": "/opt/openclaw",
    "auto_start": true,
    "systemd_unit": "/etc/systemd/system/openclaw.service"
  }
}
```

### 功能配置

```json
"features": {
  "auto_update": true,
  "auto_backup": true,
  "backup_interval": 86400,
  "max_backups": 5,
  "compression_enabled": true
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `auto_update` | boolean | 是否自动更新 |
| `auto_backup` | boolean | 是否自动备份 |
| `backup_interval` | number | 备份间隔（秒） |
| `max_backups` | number | 最大备份数量 |
| `compression_enabled` | boolean | 是否启用压缩 |

### 网络配置

```json
"network": {
  "proxy_enabled": false,
  "proxy_url": "",
  "timeout": 30000,
  "retry_strategy": "exponential_backoff"
}
```

### 监控配置

```json
"monitoring": {
  "enabled": true,
  "metrics_interval": 60,
  "alert_threshold": {
    "cpu_usage": 80,
    "memory_usage": 85,
    "disk_usage": 90
  }
}
```

## 配置验证规则

### 1. 结构验证
- 配置必须是有效的JSON对象
- 必填字段不能缺失

### 2. 类型验证
- 字段类型必须符合要求
- 枚举值必须在允许范围内

### 3. 值范围验证
- 数值必须在指定范围内
- 字符串长度必须符合要求

### 4. 安全性验证
- 不能使用默认或测试API密钥
- 生产环境应启用SSL
- 不应记录敏感数据

### 5. 兼容性验证
- 配置必须满足系统最低要求
- 操作系统特定配置必须正确

## 导入配置

### 通过Web界面导入

1. 登录系统
2. 进入"配置管理"页面
3. 点击"导入配置"按钮
4. 选择JSON配置文件
5. 系统会自动验证并导入

### 通过API导入

```bash
POST /api/user-configs/import
Content-Type: application/json
Authorization: Bearer your_token

{
  "name": "配置名称",
  "version": "1.0.0",
  ...
}
```

## 配置示例

完整的配置示例请参考：[config_example.json](./config_example.json)

## 常见问题

### Q: 配置导入失败怎么办？
A: 检查JSON格式是否正确，确保所有必填字段都已填写。

### Q: 配置验证不通过怎么办？
A: 查看验证错误信息，根据提示修改配置。

### Q: 如何创建自定义配置？
A: 可以从模版开始，然后根据需要修改配置参数。

### Q: 配置文件大小有限制吗？
A: 建议配置文件不超过1MB，过大的配置可能影响性能。

## 注意事项

1. **安全性**
   - 不要在配置中存储敏感信息
   - 使用强密码和API密钥
   - 生产环境关闭调试模式

2. **性能**
   - 合理设置超时和重试次数
   - 根据系统资源调整内存和CPU限制
   - 启用缓存可以提高性能

3. **兼容性**
   - 确保配置满足系统最低要求
   - 为不同操作系统提供特定配置
   - 测试配置在不同环境下的表现

4. **维护**
   - 定期更新配置版本
   - 记录配置变更历史
   - 备份重要配置