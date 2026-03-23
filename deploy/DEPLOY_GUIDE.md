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

## 🚀 快速部署步骤

### 第一步：服务器环境准备

1. **登录腾讯云服务器**
   ```bash
   ssh root@your_server_ip
   ```

2. **安装基础软件**
   ```bash
   # 更新系统
   apt-get update && apt-get upgrade -y

   # 安装Node.js 18.x
   curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
   apt-get install -y nodejs

   # 验证安装
   node -v  # 应显示 v18.x.x
   npm -v

   # 安装Nginx
   apt-get install -y nginx

   # 安装PM2
   npm install -g pm2
   ```

3. **安装MySQL（如果尚未安装）**
   ```bash
   apt-get install -y mysql-server

   # 启动MySQL
   systemctl start mysql
   systemctl enable mysql

   # 创建数据库
   mysql -u root -p
   ```
   ```sql
   CREATE DATABASE openclaw_config CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'openclaw'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON openclaw_config.* TO 'openclaw'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

### 第二步：上传项目代码

1. **方法一：使用Git（推荐）**
   ```bash
   cd /var/www
   git clone https://your-repo-url/openclaw_tools.git
   ```

2. **方法二：使用SCP上传**
   ```bash
   # 在本地执行
   scp -r ./openclaw_tools root@your_server_ip:/var/www/
   ```

### 第三步：配置数据库

1. **初始化数据库表**
   ```bash
   cd /var/www/openclaw_tools/backend
   npm install

   # 创建数据库表
   node scripts/initDatabase.js
   ```

2. **修改生产环境配置**
   ```bash
   # 编辑 .env.production 文件
   nano /var/www/openclaw_tools/backend/.env.production
   ```
   ```env
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_NAME=openclaw_config
   DB_USER=openclaw
   DB_PASSWORD=your_actual_password
   JWT_SECRET=生成一个复杂的随机字符串
   PORT=3000
   ```

### 第四步：构建前端

```bash
cd /var/www/openclaw_tools/frontend
npm install
npm run build
```

### 第五步：配置Nginx

```bash
# 复制Nginx配置
cp /var/www/openclaw_tools/deploy/nginx.conf /etc/nginx/sites-available/openclaw

# 编辑配置，替换 your_server_ip 为实际IP
nano /etc/nginx/sites-available/openclaw

# 启用站点
ln -sf /etc/nginx/sites-available/openclaw /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重载Nginx
systemctl reload nginx
```

### 第六步：启动后端服务

```bash
cd /var/www/openclaw_tools/backend

# 使用PM2启动
pm2 start ecosystem.config.js --env production

# 保存PM2配置
pm2 save

# 设置开机自启
pm2 startup
```

---

## ✅ 验证部署

访问 `http://your_server_ip`，应该能看到前端界面。

### 常用运维命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs openclaw-backend

# 重启服务
pm2 restart openclaw-backend

# 停止服务
pm2 stop openclaw-backend

# Nginx命令
systemctl status nginx   # 查看状态
systemctl reload nginx   # 重载配置
nginx -t                 # 测试配置
```

---

## 🔒 安全建议

1. **配置防火墙**
   ```bash
   ufw allow 22    # SSH
   ufw allow 80    # HTTP
   ufw allow 443   # HTTPS
   ufw enable
   ```

2. **申请SSL证书（可选但推荐）**
   - 使用 Let's Encrypt 免费证书
   - 腾讯云SSL证书服务

3. **修改数据库密码**
   - 使用强密码
   - 不要使用默认密码

4. **定期备份数据库**
   ```bash
   mysqldump -u openclaw -p openclaw_config > backup_$(date +%Y%m%d).sql
   ```

---

## 📁 项目文件结构

```
/var/www/openclaw/
├── backend/
│   ├── src/
│   │   ├── controllers/    # 控制器
│   │   ├── models/         # 数据模型
│   │   ├── routes/         # 路由
│   │   ├── services/       # 业务逻辑
│   │   └── index.js         # 入口文件
│   ├── ecosystem.config.js  # PM2配置
│   ├── .env.production      # 生产环境配置
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   ├── components/      # 公共组件
│   │   └── services/         # API服务
│   ├── dist/                # 构建输出
│   └── package.json
└── deploy/
    ├── nginx.conf           # Nginx配置
    └── deploy.sh            # 部署脚本
```
