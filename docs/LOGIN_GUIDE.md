# OpenClaw智能配置系统 - 登录指南

## 用户登录

### 普通用户登录流程

1. **获取邀请码**
   - 联系管理员获取11位邀请码
   - 邀请码格式：`ABCDEFGHIJK`（11位大写字母）

2. **打开登录页面**
   - 访问前端应用：`    `
   - 进入登录页面

3. **输入邀请码**
   - 在登录页面输入11位邀请码
   - 系统会自动检测设备信息（操作系统、版本等）
   - 点击"登录"按钮

4. **登录成功**
   - 系统自动生成JWT Token
   - Token保存在浏览器localStorage中
   - 跳转到仪表盘页面

### 登录接口

**请求示例：**
```bash
POST /api/auth/login
Content-Type: application/json

{
  "code": "ABCDEFGHIJK",
  "device_id": "device_abc123",
  "device_info": {
    "device_name": "Windows PC",
    "os_type": "Windows",
    "os_version": "10.0.19041"
  }
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "device_id": "device_abc123",
      "device_name": "Windows PC",
      "invitation_code": "ABCDEFGHIJK"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

## 管理员登录

### 创建管理员邀请码

目前系统没有专门的管理员登录接口，管理员也是通过邀请码登录。要创建管理员权限的邀请码，需要：

#### 方法1: 通过API创建（推荐）

1. **启动后端服务**
   ```bash
   cd backend
   npm start
   ```

2. **使用API创建邀请码**
   ```bash
   # 使用curl
   curl -X POST http://localhost:3000/api/invitation-codes/generate \
     -H "Content-Type: application/json" \
     -d '{"max_devices": 10}'

   # 使用Postman等工具
   POST http://localhost:3000/api/invitation-codes/generate
   Body: {
     "max_devices": 10
   }
   ```

3. **获取邀请码**
   响应会返回生成的邀请码：
   ```json
   {
     "success": true,
     "data": {
       "id": 1,
       "code": "ABCDEFGHIJK",
       "max_devices": 10,
       "current_devices": 0,
       "status": "active"
     }
   }
   ```

4. **使用邀请码登录**
   - 使用返回的邀请码在前端登录
   - 登录后即可使用所有功能

#### 方法2: 直接在数据库中插入（快速测试）

```sql
-- 插入管理员邀请码
INSERT INTO invitation_codes (code, max_devices, current_devices, status)
VALUES ('ADMINCODE123', 100, 0, 'active');
```

然后使用邀请码 `ADMINCODE123` 登录。

### 管理员权限说明

当前系统通过以下方式区分权限：

1. **邀请码设备数量限制**
   - 普通用户：最多3台设备
   - 管理员：可以设置更多设备（如100台）

2. **模版审核权限**
   - 任何人都可以创建模版
   - 模版需要审核才能使用
   - 审核通过后才能被推荐

3. **配置管理权限**
   - 用户只能管理自己的配置
   - 管理员可以查看所有用户配置（需要扩展）

## Token认证

### Token使用

登录成功后，所有需要认证的接口都需要在请求头中携带Token：

```javascript
// 前端自动处理（已实现）
headers: {
  'Authorization': 'Bearer ' + token
}
```

### Token刷新

Token默认24小时过期，过期后可以刷新：

```bash
POST /api/auth/refresh
Content-Type: application/json

{
  "token": "your_expired_token"
}
```

### 登出

```bash
POST /api/auth/logout
Authorization: Bearer your_token
```

## 快速开始

### 1. 创建管理员邀请码

```bash
# 使用API创建
curl -X POST http://localhost:3000/api/invitation-codes/generate \
  -H "Content-Type: application/json" \
  -d '{"max_devices": 100}'
```

### 2. 使用邀请码登录

1. 打开浏览器访问：`http://localhost:5173`
2. 输入上面创建的邀请码
3. 点击登录

### 3. 开始使用

登录成功后可以：
- ✅ 查看仪表盘
- ✅ 使用配置向导
- ✅ 管理配置
- ✅ 查看日志
- ✅ 创建和管理模版

## API文档

完整的API文档：`http://localhost:3000/api-docs`

包含所有接口的详细说明和示例。

## 注意事项

1. **邀请码安全**
   - 邀请码应该安全保管
   - 不要在公开渠道分享

2. **设备限制**
   - 每个邀请码有最大设备数量限制
   - 超过限制后无法绑定新设备
   - 可以解绑旧设备释放名额

3. **Token过期**
   - Token默认24小时过期
   - 过期后需要重新登录或刷新Token

4. **网络连接**
   - 确保能够访问后端API（http://localhost:3000）
   - 如果使用远程数据库，确保网络通畅