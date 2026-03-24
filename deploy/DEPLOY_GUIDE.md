# OpenClaw 智能配置系统 - 腾讯云部署指南

## 📋 部署架构

```
用户浏览器
    │
    │  http/https
    ▼
Nginx (端口 80/443)
    │
    ├── /          → 前端静态文件
    │
    └── /api       → 反向代理到后端
                        │
                        ▼
                    Node.js + Express (端口 3000)
                        │
                        ▼
                    MySQL 数据库
```

---

## 🚀 详细部署步骤

### 第一阶段：本地打包（Windows PowerShell）

```powershell
cd d:\Tu工作同步\My工作同步\openclaw_tools
.\scripts\package_for_deploy.ps1
```

打包完成后会生成 `openclaw_deploy.zip` 文件

### 第二阶段：上传到服务器

```powershell
scp openclaw_deploy.zip root@134.175.18.139:/opt/openclaw_tool_server/
```

---

### 连接服务器

```bash
ssh root@134.175.18.139
```

---

### 第三阶段：服务器配置

#### 3.1 解压上传的文件

```bash
cd /opt/openclaw_tool_server
unzip openclaw_deploy.zip

# 验证解压结果
ls -la
# 应该看到: backend  config  database  deploy  frontend  LICENSE
```

#### 3.2 安装Node.js依赖

```bash
cd /opt/openclaw_tool_server/backend

# 注意：是 --production 不是 -production
npm install --production
```

#### 3.3 检查Node.js版本

```bash
node -v
npm -v

# 如果版本低于16，需要升级Node.js
```

---

### 第四阶段：配置文件

#### 4.1 创建环境变量文件

```bash
cd /opt/openclaw_tool_server/backend

cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=openclaw_config
DB_USER=root
DB_PASSWORD=您的数据库密码
JWT_SECRET=openclaw_production_jwt_secret_2024
EOF
```

#### 4.2 PM2配置文件

如果 ecosystem.config.js 格式不对，服务器上直接创建：

```bash
cat > /opt/openclaw_tool_server/backend/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'openclaw-backend',
      script: 'src/index.js',
      cwd: '/opt/openclaw_tool_server/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      watch: false,
      max_memory_restart: '500M',
      autorestart: true,
      restart_delay: 4000
    }
  ]
};
EOF
```

---

### 第五阶段：启动服务

#### 5.1 使用PM2启动后端

```bash
cd /opt/openclaw_tool_server/backend

# 创建日志目录
mkdir -p logs

# 启动服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs openclaw-backend
```

#### 5.2 PM2常用命令

```bash
# 查看所有进程
pm2 list

# 重启单个服务
pm2 restart openclaw-backend

# 停止单个服务（不要用 pm2 delete all！）
pm2 stop openclaw-backend

# 删除单个服务
pm2 delete openclaw-backend

# 保存进程列表（开机自启）
pm2 save

# 查看日志
pm2 logs
pm2 logs --lines 100
```

⚠️ **注意**：`pm2 delete all` 会删除所有PM2进程，很危险！

---

### 第六阶段：Nginx配置

#### 6.1 创建Nginx配置文件

```bash
cat > /etc/nginx/conf.d/openclaw.conf << 'EOF'
server {
    listen 80;
    server_name 134.175.18.139;

    root /opt/openclaw_tool_server/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        
    }

    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF
```

#### 6.2 重启Nginx

```bash
# 测试配置
nginx -t

# 重启Nginx
systemctl reload nginx
```

---

### 第七阶段：防火墙配置

```bash
# 开放端口（腾讯云安全组也要配置）
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=3000/tcp

# 重载防火墙
firewall-cmd --reload

# 或者直接用云服务器安全组规则
```

---

## ✅ 验证部署

### 检查服务状态

```bash
# 检查PM2进程
pm2 status

# 检查端口监听
netstat -tlnp | grep -E '80|3000'

# 检查Nginx状态
systemctl status nginx
```

### 访问测试

```
http://134.175.18.139
```

---

## 🔧 宝塔面板配置（可选）

如果使用宝塔面板：

1. **安装PM2管理器** - 软件商店 → PM2管理器
2. **添加项目** - Node项目，路径选择 `/opt/openclaw_tool_server/backend`
3. **配置反向代理** - 网站 → 反向代理 → 目标URL `http://127.0.0.1:3000`

---

## 🔧 常用维护命令

### 重启服务

```bash
# 重启后端
pm2 restart openclaw-backend

# 重启Nginx
systemctl reload nginx
```

### 更新代码

```bash
cd /opt/openclaw_tool_server

# 上传新的zip包后
unzip -o openclaw_deploy.zip

# 重启服务
pm2 restart openclaw-backend
```

---

## 🆘 故障排查

### 后端无法启动

```bash
# 查看错误日志
pm2 logs openclaw-backend

# 手动启动测试
cd /opt/openclaw_tool_server/backend
node src/index.js
```

### 数据库连接失败

```bash
# 测试数据库连接
mysql -u root -p -e "SHOW DATABASES;"

# 检查.env.production配置
cat /opt/openclaw_tool_server/backend/.env.production
```

### Nginx 502错误

```bash
# 检查后端是否运行
pm2 status

# 检查SELinux
getenforce
# 如果是Enforcing，尝试: setenforce 0
```

---

## 📁 目录结构

```
/opt/openclaw_tool_server/
├── backend/              # 后端服务
│   ├── src/            # 源代码
│   ├── ecosystem.config.js  # PM2配置
│   ├── .env.production # 生产环境配置
│   └── package.json
├── frontend/            # 前端构建文件
│   └── dist/           # 静态文件
├── database/            # 数据库脚本
├── config/              # 配置文件
├── deploy/              # 部署文档
└── LICENSE              # MIT许可证
```

---

## ⚠️ 注意事项

1. **PM2命令**：`pm2 delete all` 会删除所有进程，很危险！
2. **数据库密码**：请修改默认密码为强密码
3. **JWT_SECRET**：生产环境请使用复杂的随机字符串
4. **防火墙**：确保腾讯云安全组开放80端口
5. **备份**：部署前请备份数据库和重要配置
