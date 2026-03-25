# OpenClaw Launcher

OpenClaw 本地启动器 - 用于检测本地 OpenClaw 安装状态和启动服务

## 功能

1. **自动检测 OpenClaw 安装状态**
   - 检测 OpenClaw 安装目录
   - 读取版本信息
   - 检测 Gateway 是否运行

2. **自定义协议支持**
   - `openclaw://check` - 检查状态
   - `openclaw://launch` - 启动 OpenClaw

3. **HTTP API 服务**
   - `http://127.0.0.1:18790/api/check` - 检查状态
   - `http://127.0.0.1:18790/api/status` - 检查状态（同上）
   - `http://127.0.0.1:18790/api/launch` - 启动 OpenClaw

## API 返回格式

### /api/check

```json
{
  "success": true,
  "installed": true,
  "directory": "C:\\Users\\username\\.openclaw",
  "version": "1.0.0",
  "gatewayPort": 18789,
  "gatewayRunning": true,
  "platform": "win32",
  "arch": "x64"
}
```

## 使用方式

### 开发模式

```bash
cd electron-launcher
npm install
npm start
```

### 打包

```bash
npm run dist
```

生成的 exe 文件在 `dist` 目录下。

## 与前端集成

前端通过 HTTP 请求调用 Launcher API：

```javascript
const response = await fetch('http://127.0.0.1:18790/api/check');
const data = await response.json();
console.log(data.installed); // 是否已安装
console.log(data.gatewayRunning); // Gateway是否运行
```

## 检测逻辑

1. 首先检测 Gateway 端口（18789-18795）
2. 检测 OpenClaw 安装目录：
   - Windows: `%USERPROFILE%\.openclaw`
  - 或 `%LOCALAPPDATA%\openclaw`
  - 或 `%APPDATA%\openclaw`

## 注意事项

- Launcher 需要在后台运行
- 首次使用需要允许防火墙放行
- 浏览器访问网页时会先尝试连接 Launcher API
