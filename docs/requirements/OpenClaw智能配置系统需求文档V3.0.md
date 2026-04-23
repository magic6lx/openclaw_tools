# OpenClaw 配置共享平台需求文档 V3.0

## 一、文档概述

### 1.1 文档目的
本文档描述 OpenClaw 配置共享平台的核心需求、技术架构和实现细节，版本3.0重点简化系统架构、增强配置共享能力和 Token 代理转发功能。

### 1.2 需求要点速览

#### 用户端（普通用户）
| 功能 | 说明 |
|------|------|
| 邀请码登录 | 输入邀请码即可使用，无需注册 |
| 一键安装 | 网页点击安装OpenClaw，实时显示日志 |
| 配置管理 | 导入/导出/应用配置模板 |
| 运营管理 | 启动/停止Gateway，查看状态 |

#### 管理端（管理员）
| 功能 | 说明 |
|------|------|
| 仪表盘 | 设备统计、使用情况、日志概览 |
| 邀请码管理 | 创建/禁用邀请码，设置设备限制 |
| 配置模版 | 导入/审核/发布配置模版 |
| Token代理 | 配置API转发，限制用户使用额度 |
| 日志管理 | 查看所有客户端日志 |

#### Launcher（用户电脑后台）
| 功能 | 说明 |
|------|------|
| 本地HTTP服务 | 提供API接口供前端调用 |
| 日志上报 | 每30秒上报日志到服务器 |
| 开机自启 | 创建计划任务+桌面快捷方式 |
| ZIP分发 | 避免EXE被系统拦截 |

#### 自动化部署
| 脚本 | 说明 |
|------|------|
| install-deps.bat | 一键安装所有npm依赖 |
| init-db.bat | 交互式数据库初始化 |
| start.bat | 一键启动所有服务 |

---

### 1.3 版本历史
| 版本 | 日期 | 作者 | 说明 |
|------|------|------|------|
| V1.0 | 2026-03-15 | 开发团队 | 初始版本 |
| V2.0 | 2026-04-02 | 开发团队 | 增加跨客户端配置同步、路径适配系统 |
| V2.1 | 2026-04-03 | 开发团队 | 增加 Gateway 服务管理、终端服务、运行时监控模块 |
| V3.0 | 2026-04-23 | 开发团队 | 架构重构，简化部署，添加 Token 代理转发功能 |
| V3.1 | 2026-04-23 | 开发团队 | 增加 Launcher 下载检测引导功能 |
| V3.2 | 2026-04-23 | 开发团队 | 增加依赖安装和数据库初始化自动化脚本 |

---

## 二、系统架构

### 2.1 整体架构图
```
┌─────────────────────────────────────────────────────────────────────────┐
│                              服务器端                                     │
│                                                                          │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐               │
│   │  前端 3001   │    │  API 3002   │    │ Token代理    │               │
│   │  React      │◄──►│  Express    │    │ (可选)       │               │
│   │  Ant Design │    │  MySQL      │    │              │               │
│   └─────────────┘    └─────────────┘    └─────────────┘               │
│          │                  │                   │                        │
└──────────│──────────────────│───────────────────│────────────────────────┘
           │                  │                   │
           │                  │   ┌───────────────▼───────────────┐
           │                  │   │        Token 代理流程          │
           │                  │   │                                │
           │                  │   │  用户请求 ──► 服务器 ──► OpenAI │
           │                  │   │     ◄───────────              │
           │                  │   │     限流 + 记录                │
           │                  │   └────────────────────────────────┘
           │                  │
           │                  ▼
           │         ┌─────────────────┐
           │         │    MySQL        │
           │         │  - invitations  │
           │         │  - devices      │
           │         │  - logs         │
           │         │  - templates    │
           │         │  - tokens       │
           │         └─────────────────┘
           │
           │  ┌─────────────────────────────────────────────────────────┐
           │  │                      用户电脑                            │
           │  │                                                      │
           │  │   ┌──────────────┐         ┌──────────────┐           │
           │  │   │  浏览器 3001  │◄──API──►│ Launcher     │           │
           │  │   │  (Web页面)    │         │  127.0.0.1   │           │
           │  │   └──────────────┘         │  :3003        │           │
           │  │                              └──────────────┘           │
           │  │                                    │                     │
           │  │                                    ▼                     │
           │  │                          ┌──────────────┐                │
           │  │                          │ OpenClaw CLI │                │
           │  │                          │ ~/.openclaw  │                │
           │  │                          └──────────────┘                │
           │  │                                                      │
           └──│───────────────────────────────────────────────────────-─┘
              │
              │  远程: http://服务器IP:3001
              │  本地: http://127.0.0.1:3001 (开发)
              │
└───────────────────────────────────────────────────────────────────────-─┘
```

### 2.2 技术栈
| 组件 | 技术 | 版本要求 | 说明 |
|------|------|----------|------|
| 前端 | React + Vite | 最新版 | 页面展示，用户交互 |
| UI库 | Ant Design | 5.x | 组件库 |
| 后端 | Node.js + Express | 18+ | API服务 |
| 数据库 | MySQL | 8.0+ | 数据存储 |
| Launcher | Node.js 原生 | 18+ | 本地HTTP服务，无UI |
| 包管理 | npm | 最新版 | 依赖管理 |

### 2.3 端口规划
| 端口 | 服务 | 位置 | 访问方式 |
|------|------|------|----------|
| 3001 | 前端静态 | 服务器 | 公网访问 |
| 3002 | API服务 | 服务器 | 公网访问 |
| 3003 | Launcher API | 用户电脑 | **仅本地访问** |

---

## 三、功能模块

### 3.1 用户端功能（普通用户）

#### 3.1.0 Launcher 下载引导（首次访问）

**功能说明**：用户首次访问网页时，检测 Launcher 是否已安装，若未安装则引导下载。

**检测流程**：
```
用户打开浏览器
      ↓
访问 http://服务器IP:3001
      ↓
前端检测 http://127.0.0.1:3003/status
      ↓              ↓
  检测成功        检测失败
      ↓              ↓
  正常登录     显示下载引导页面
      ↓              ↓
              ┌─────────────────┐
              │  Launcher 未安装 │
              │                 │
              │  [下载Launcher]  │
              │  (服务器提供下载) │
              └─────────────────┘
                      ↓
              用户下载并运行
                      ↓
              刷新页面 → 正常登录
```

**实现逻辑**：
```javascript
// 前端页面加载时检测
useEffect(() => {
  fetch('http://127.0.0.1:3003/status')
    .then(res => res.json())
    .then(data => {
      setLauncherReady(true);
      setDeviceId(data.deviceId);
    })
    .catch(() => {
      setLauncherReady(false);
    });
}, []);
```

**下载页面设计**：
- 显示 Logo 和欢迎语
- 说明 Launcher 的作用
- 提供下载按钮
- 简要安装说明

#### 3.1.1 邀请码登录
- 输入邀请码自动注册/登录
- 设备绑定到邀请码
- JWT Token 认证

#### 3.1.2 首页
- 系统说明
- 快捷入口（安装、运营、配置）

#### 3.1.3 一键安装 OpenClaw
- 调用 Launcher 本地 API
- 执行官方静默安装脚本
- 实时显示安装日志

**安装命令**：
```powershell
# Windows
powershell -Command "iwr -useb https://openclaw.ai/install.ps1 | iex -NoOnboard"

# macOS/Linux
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard
```

#### 3.1.4 配置管理
- 查看我的配置
- 下载配置模版
- 应用配置到本地

#### 3.1.5 运营管理
- 启动/停止 Gateway
- 查看运行状态

---

### 3.2 管理端功能（管理员）

#### 3.2.1 仪表盘
- 设备统计
- 使用情况
- 日志概览

#### 3.2.2 配置模版管理
- 导入配置（从用户提交）
- 编辑/审核配置
- 发布/下架配置
- 设置 Token 代理

#### 3.2.3 邀请码管理
- 创建邀请码
- 设置设备数量限制
- 设置角色（admin/user）
- 启用/禁用

#### 3.2.4 Token 代理管理
- 配置代理 API 地址
- 设置流量限额
- 查看使用记录

#### 3.2.5 日志管理
- 查看所有客户端日志
- 按设备/级别筛选
- 日志统计

---

### 3.3 Launcher 功能（用户电脑后台）

#### 3.3.0 Launcher 下载与安装

**分发格式**：ZIP压缩包（避免EXE被浏览器/系统拦截）

**安装流程**：
```
1. 用户从网页下载 Launcher ZIP 包
   下载地址：http://服务器IP:3001/launcher/download
      ↓
2. 解压到任意目录（如 C:\OpenClawLauncher）
      ↓
3. 双击 openclaw-launcher.exe 运行
      ↓
4. Launcher 自动：
   - 创建桌面快捷方式
   - 注册开机自启动（Windows计划任务）
   - 最小化到托盘后台运行
```

**目录结构**：
```
C:\OpenClawLauncher\
├── openclaw-launcher.exe    # 主程序
├── config.json             # 配置文件（可选）
└── logs\                   # 日志目录
    └── launcher.log
```

**自动启动机制**（Windows计划任务）：
```
任务名称：OpenClaw Launcher
触发器：用户登录时
操作：启动 C:\OpenClawLauncher\openclaw-launcher.exe
状态：隐藏运行（无窗口）
```

#### 3.3.1 本地 HTTP API
| 端点 | 方法 | 说明 |
|------|------|------|
| `/status` | GET | 获取状态 |
| `/install/start` | POST | 开始安装 |
| `/install/status` | GET | 安装状态和日志 |
| `/config/import` | GET | 导入本地配置 |
| `/config/export` | POST | 应用配置到本地 |
| `/gateway/start` | POST | 启动 Gateway |
| `/gateway/stop` | POST | 停止 Gateway |
| `/gateway/status` | GET | Gateway 状态 |

#### 3.3.2 日志上报
- 每30秒上报一次日志到服务器
- 包含设备ID、时间戳、级别、来源、消息

#### 3.3.3 设备注册
- 启动时自动生成 deviceId
- 上报到服务器绑定邀请码

---

## 四、数据模型

### 4.1 数据库表结构

#### 4.1.1 invitations（邀请码表）
```sql
CREATE TABLE invitations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE COMMENT '邀请码',
  max_devices INT DEFAULT 3 COMMENT '最大设备数',
  used_devices INT DEFAULT 0 COMMENT '已使用设备数',
  status ENUM('active', 'disabled') DEFAULT 'active' COMMENT '状态',
  role ENUM('admin', 'user') DEFAULT 'user' COMMENT '角色',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 4.1.2 devices（设备表）
```sql
CREATE TABLE devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(128) NOT NULL UNIQUE COMMENT '设备ID',
  invitation_id INT COMMENT '关联邀请码ID',
  device_name VARCHAR(128) DEFAULT '' COMMENT '设备名称',
  os_type VARCHAR(32) DEFAULT '' COMMENT '操作系统',
  os_version VARCHAR(64) DEFAULT '' COMMENT '系统版本',
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE SET NULL
);
```

#### 4.1.3 logs（日志表）
```sql
CREATE TABLE logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(128) DEFAULT '' COMMENT '设备ID',
  level ENUM('debug', 'info', 'warn', 'error') DEFAULT 'info',
  source VARCHAR(64) DEFAULT '' COMMENT '来源',
  message TEXT COMMENT '内容',
  client_timestamp TIMESTAMP NULL COMMENT '客户端时间',
  server_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.1.4 templates（配置模版表）
```sql
CREATE TABLE templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL COMMENT '模版名称',
  description TEXT COMMENT '描述',
  category VARCHAR(32) DEFAULT 'imported' COMMENT '分类',
  config_content JSON COMMENT '配置内容（脱敏后）',
  config_files JSON COMMENT '配置文件列表',
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_by INT COMMENT '创建者邀请码ID',
  token_proxy JSON COMMENT 'Token代理配置',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 4.1.5 token_usage（Token使用记录表）
```sql
CREATE TABLE token_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(128) DEFAULT '' COMMENT '设备ID',
  invitation_id INT COMMENT '邀请码ID',
  model VARCHAR(64) DEFAULT '' COMMENT '模型',
  input_tokens INT DEFAULT 0 COMMENT '输入Token',
  output_tokens INT DEFAULT 0 COMMENT '输出Token',
  request_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device_id (device_id),
  INDEX idx_invitation_id (invitation_id)
);
```

---

## 五、Token 代理功能

### 5.1 功能说明
管理员配置自己的 API Key，服务器充当中转站，转发用户的 AI 请求。

### 5.2 转发流程
```
用户电脑                      服务器                       AI服务商
    │                           │                            │
    │ OpenClaw ──────────────► │                            │
    │ 发送聊天请求              │                            │
    │ (使用代理地址)            │                            │
    │                           │ ─────────────────────────►│
    │                           │  替换为真实API Key          │
    │                           │                            │
    │ ◄──────────────────────── │                            │
    │  AI响应                   │ ◄───────────────────────── │
    │                           │                            │
    │                           │ 记录使用量                   │
```

### 5.3 代理配置数据结构
```json
{
  "enabled": true,
  "provider": "openai",
  "api_base": "https://api.openai.com/v1",
  "api_key": "sk-xxx",
  "model_mapping": {
    "gpt-4": "gpt-4"
  },
  "quota": {
    "total": 100000,
    "used": 0,
    "period": "monthly"
  }
}
```

### 5.4 脱敏配置模版结构
```json
{
  "gateway": {
    "mode": "local",
    "auth": {
      "mode": "token"
    }
  },
  "models": {
    "defaults": {
      "provider": "openai",
      "model": "gpt-4"
    },
    "providers": {
      "openai": {
        // apiKey 已移除
      }
    }
  },
  "agents": { /* 可共享 */ },
  "channels": { /* 账号token已移除 */ },
  "_openclaw_tools": {
    "proxy": {
      "enabled": true,
      "url": "http://server:3002/api/proxy/chat"
    }
  }
}
```

---

## 六、API 接口设计

### 6.1 认证相关
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 邀请码登录 |
| `/api/auth/verify` | GET | 验证Token |

### 6.2 邀请码管理（管理员）
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/invitations` | GET | 列表 |
| `/api/invitations` | POST | 创建 |
| `/api/invitations/:id` | PUT | 更新 |
| `/api/invitations/:id` | DELETE | 删除 |

### 6.3 设备管理
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/devices` | GET | 列表（管理员） |
| `/api/devices/:deviceId` | GET | 详情 |

### 6.4 日志管理
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/logs/upload` | POST | 上报日志 |
| `/api/logs` | GET | 查询日志（管理员） |

### 6.5 配置模版
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/templates` | GET | 列表 |
| `/api/templates/:id` | GET | 详情 |
| `/api/templates` | POST | 创建（导入） |
| `/api/templates/:id` | PUT | 更新 |
| `/api/templates/:id/approve` | POST | 审核通过 |

### 6.6 Token 代理
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/proxy/chat` | POST | 转发聊天请求 |
| `/api/proxy/usage` | GET | 使用量统计 |

---

## 七、部署架构

### 7.1 服务器部署
```bash
# 目录结构
/opt/openclaw_tool_server/
├── server/           # 后端代码
│   ├── src/
│   ├── package.json
│   └── scripts/      # 初始化脚本
├── client/           # 前端代码
│   ├── dist/         # 构建产物
│   └── ...
└── config/
    └── .env          # 环境变量
```

### 7.2 环境变量
```bash
# 服务器配置
PORT=3002
NODE_ENV=production

# 数据库配置
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=openclaw_tools

# JWT配置
JWT_SECRET=your_secret_key
```

### 7.3 Launcher 部署
用户下载 Launcher 后直接运行，无需安装。

```bash
# 目录结构（用户电脑）
C:\Users\{用户名}\AppData\Roaming\openclaw-launcher\
├── launcher.exe      # 主程序
└── logs/             # 日志目录
```

### 7.4 自动化脚本

#### 7.4.1 依赖安装脚本
```bash
install-deps.bat    # Windows 一键安装所有依赖
```
- 自动安装 server/client/launcher 的 npm 依赖
- 按顺序执行，无需手动 cd 目录

#### 7.4.2 数据库初始化脚本
```bash
init-db.bat         # Windows 数据库初始化
```
- 交互式输入数据库配置
- 自动执行 init-db.sql
- 清空重建所有表
- 插入默认邀请码

#### 7.4.3 服务器启动脚本
```bash
start.bat           # Windows 一键启动所有服务
```

#### 7.4.4 数据库表结构

| 表名 | 说明 |
|------|------|
| invitations | 邀请码表 |
| devices | 设备表 |
| logs | 日志表 |
| templates | 配置模版表 |
| token_usage | Token使用记录表 |

---

## 八、安全考虑

### 8.1 认证安全
- JWT Token 7天过期
- Token需验证邀请码有效性
- 邀请码设备数限制

### 8.2 API 安全
- CORS 限制
- 请求频率限制
- 参数校验

### 8.3 Token 代理安全
- API Key 仅存储在服务器
- 请求日志完整记录
- 流量限额保护

### 8.4 敏感信息处理
- 配置文件中的 API Keys 自动移除
- Channel 认证信息脱敏
- 日志中敏感信息过滤

---

## 九、待实现功能

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 配置导入/导出 | P0 | Launcher 读取/写入本地配置 |
| Token 代理转发 | P0 | 完整实现代理流程 |
| 配置审核流程 | P1 | 管理员审核用户提交的配置 |
| 流量统计 | P1 | Token 使用量统计 |
| Workspace 同步 | P2 | Skills、记忆等文件同步 |

---

## 十、版本差异

### V2.x vs V3.0 对比

| 项目 | V2.x | V3.0 |
|------|------|------|
| Launcher 技术 | Rust/Tauri/Electron | Node.js 原生 |
| 包体积 | ~200MB | ~5MB |
| 托盘UI | 有 | 无（后台运行） |
| Web终端 | 有 | 无 |
| Token代理 | 无 | 有 |
| 配置脱敏 | 基础 | 完整 |
| 部署复杂度 | 高 | 低 |
