# Git 操作指南

本文档记录常用的 Git 操作命令，**不要提交到 Git 仓库**。

---

## 📌 基础配置

### 查看配置
```bash
git config --list
git config user.name
git config user.email
```

### 设置用户信息
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## 📌 仓库操作

### 初始化新仓库
```bash
git init
```

### 克隆远程仓库
```bash
git clone https://github.com/username/repository.git
git clone https://github.com/username/repository.git my-folder
```

### 添加远程仓库
```bash
git remote add origin https://github.com/username/repository.git
git remote -v                          # 查看远程仓库
git remote remove origin               # 删除远程仓库
```

---

## 📌 日常工作流

### 1. 查看状态
```bash
git status                     # 查看工作区状态
git status -s                  # 简洁模式
```

### 2. 添加文件到暂存区
```bash
git add filename.js            # 添加单个文件
git add file1.js file2.js      # 添加多个文件
git add .                       # 添加所有文件
git add -A                      # 添加所有文件（包括删除）
```

### 3. 提交
```bash
git commit -m "提交信息"         # 提交暂存区文件
git commit -am "提交信息"       # 直接提交所有已跟踪文件（跳过 git add）
git commit --amend              # 修改最后一次提交
```

### 4. 推送到远程
```bash
git push                       # 推送到当前分支
git push -u origin master      # 首次推送并设置上游
git push origin branch-name     # 推送到指定分支
git push --force               # 强制推送（慎用！）
```

### 5. 拉取更新
```bash
git pull                       # 拉取并合并
git pull origin master         # 拉取指定分支
```

---

## 📌 分支操作

### 查看分支
```bash
git branch                     # 查看本地分支
git branch -a                  # 查看所有分支（包括远程）
git branch -r                  # 查看远程分支
```

### 创建分支
```bash
git branch feature-name         # 创建新分支
git checkout feature-name      # 切换到新分支
git checkout -b feature-name   # 创建并切换（简写）
git switch -c feature-name     # 同上（新版命令）
```

### 合并分支
```bash
git checkout master            # 切换到主分支
git merge feature-name         # 合并功能分支
```

### 删除分支
```bash
git branch -d feature-name     # 删除本地分支
git push origin --delete feature-name  # 删除远程分支
```

---

## 📌 查看历史

### 查看提交历史
```bash
git log                        # 查看完整日志
git log --oneline              # 简洁日志（每行一条）
git log -n 5                   # 查看最近5条
git log --graph                # 图形化显示分支
```

### 查看文件变化
```bash
git diff                       # 工作区 vs 暂存区
git diff --cached              # 暂存区 vs 最新提交
git diff HEAD                  # 工作区 vs 最新提交
git diff branch1..branch2      # 两个分支的差异
```

### 查看某文件的历史
```bash
git log filename.js            # 查看文件的提交历史
git log -p filename.js         # 查看文件的详细修改
```

---

## 📌 撤销操作

### 撤销工作区的修改
```bash
git checkout -- filename       # 撤销单个文件（未暂存）
git checkout -- .              # 撤销所有文件（未暂存）
git restore filename           # 新版命令（效果相同）
```

### 撤销暂存区的文件
```bash
git reset HEAD filename        # 取消暂存单个文件
git reset HEAD                 # 取消所有暂存
git restore --staged filename  # 新版命令（效果相同）
```

### 回退到之前的提交
```bash
git reset --soft HEAD~1        # 回退1个提交（保留更改在暂存区）
git reset --mixed HEAD~1       # 回退1个提交（保留更改在工作区）
git reset --hard HEAD~1        # 回退1个提交（丢弃所有更改）
git reset --hard commit-hash   # 回退到指定提交
```

### 撤销已推送的提交（需要谨慎）
```bash
git revert commit-hash          # 创建一个新提交来撤销指定提交
```

---

## 📌 标签操作

### 创建标签
```bash
git tag v1.0.0                 # 创建轻量标签
git tag -a v1.0.0 -m "版本1.0" # 创建附注标签
git tag -a v1.0.0 commit-hash  # 给指定提交打标签
```

### 查看和推送标签
```bash
git tag                        # 查看所有标签
git show v1.0.0               # 查看标签详情
git push origin v1.0.0         # 推送单个标签
git push origin --tags         # 推送所有标签
```

### 删除标签
```bash
git tag -d v1.0.0              # 删除本地标签
git push origin --delete v1.0.0 # 删除远程标签
```

---

## 📌 储藏工作（Stash）

### 储藏当前工作
```bash
git stash                      # 储藏当前更改
git stash save "备注信息"       # 储藏并添加备注
git stash -u                   # 包含未跟踪文件
```

### 查看和应用储藏
```bash
git stash list                 # 查看所有储藏
git stash show                 # 查看储藏内容
git stash apply               # 应用储藏（保留储藏记录）
git stash pop                 # 应用储藏并删除
git stash drop                # 删除储藏
git stash clear               # 清空所有储藏
```

---

## 📌 清理操作

### 清理未跟踪文件
```bash
git clean -n                  # 预览将要删除的文件（不实际删除）
git clean -f                  # 删除未跟踪文件
git clean -fd                 # 删除未跟踪文件和目录
git clean -fX                 # 只删除被忽略的文件
git clean -fx                 # 删除所有未跟踪文件
```

---

## 📌 子模块操作

### 添加子模块
```bash
git submodule add https://github.com/xxx/xxx.git libs/xxx
```

### 更新子模块
```bash
git submodule update --init --recursive
git submodule update --remote libs/xxx
```

### 删除子模块
```bash
git submodule deinit libs/xxx
git rm libs/xxx
rm -rf .git/modules/libs/xxx
```

---

## 📌 高级操作

### 变基（Rebase）
```bash
git rebase master              # 变基到主分支
git rebase -i HEAD~3          # 交互式变基最近3个提交
# 在交互模式中可以：pick, squash, edit, drop 等
```

### 暂存特定更改
```bash
git stash -p                   # 交互式暂存（可以选择性地暂存部分更改）
```

### 搜索提交历史
```bash
git log --grep="关键字"        # 搜索提交信息
git log -S "代码片段"          # 搜索包含特定代码的提交
```

### 捡取（Cherry-pick）单个提交
```bash
git cherry-pick commit-hash    # 将指定提交应用到当前分支
```

---

## 📌 常见问题处理

### 1. 合并冲突
```bash
# 解决冲突后
git add conflicted-file.js
git commit -m "解决冲突"
```

### 2. 取消正在进行的合并
```bash
git merge --abort
```

### 3. 修改远程仓库 URL
```bash
git remote set-url origin https://github.com/username/new-repo.git
```

### 4. 忽略文件的修改
```bash
git update-index --assume-unchanged filename
git update-index --no-assume-unchanged filename
```

### 5. SSH 和 HTTPS 切换
```bash
# SSH
git remote set-url origin git@github.com:username/repo.git
# HTTPS
git remote set-url origin https://github.com/username/repo.git
```

---

## 📌 Git 工作流示例

### 完整功能开发流程
```bash
# 1. 确保主分支最新
git checkout master
git pull origin master

# 2. 创建功能分支
git checkout -b feature/my-feature

# 3. 开发并提交
git add .
git commit -m "实现新功能"

# 4. 推送功能分支
git push -u origin feature/my-feature

# 5. 合并回主分支
git checkout master
git merge feature/my-feature
git push origin master

# 6. 删除功能分支
git branch -d feature/my-feature
git push origin --delete feature/my-feature
```

---

## 📌 部署到腾讯云服务器

推荐使用 **Git 拉取** 方式部署，简单高效。如果服务器无法访问 GitHub，再使用打包文件方式。

---

### 方式一：Git 拉取部署（推荐）

#### 首次部署

```bash
# 1. 克隆仓库
cd /opt
git clone https://github.com/magic6lx/openclaw_tools.git
cd openclaw_tool_server

# 2. 安装后端依赖
cd backend
npm install --production
cd ..

# 3. 安装前端依赖并构建
cd frontend
npm install --production
npm run build
cd ..

# 4. 配置环境变量
cp config/.env.example backend/.env
nano backend/.env  # 编辑配置

# 5. 运行数据库迁移
cd database
node migrate_client_system_info.js
cd ..

# 6. 启动服务
cd backend
pm2 start ecosystem.config.js
```

#### 后续更新部署

```bash
# 服务器上执行（推荐）
cd /opt/openclaw_tool_server
git pull
pm2 restart all
```

如果前端有更新，需要重新构建：
```bash
cd /opt/openclaw_tool_server/frontend
npm run build
pm2 restart all
```

---

### 方式二：打包文件上传部署

适用于服务器无法访问 GitHub 的情况。

#### 1. 本地打包
```bash
# 在Windows上执行打包脚本
.\scripts\package_for_deploy.ps1

# 生成 openclaw_deploy.zip 文件
```

#### 2. 上传到服务器
```bash
scp openclaw_deploy.zip root@134.175.18.139:/opt/openclaw_tool_server/
```

#### 3. 服务器端解压
```bash
ssh root@134.175.18.139
cd /opt/openclaw_tool_server
unzip -o openclaw_deploy.zip
```

#### 4. 安装依赖
```bash
# 后端依赖
cd /opt/openclaw_tool_server/backend
npm install --production

# 前端已打包，无需安装
```

#### 5. 配置环境变量
```bash
cat > /opt/openclaw_tool_server/backend/.env << 'EOF'
NODE_ENV=production
PORT=3002
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=openclaw_config
DB_USER=root
DB_PASSWORD=您的数据库密码
JWT_SECRET=openclaw_production_jwt_secret_2024
EOF
```

#### 6. 启动服务
```bash
cd /opt/openclaw_tool_server/backend
pm2 start ecosystem.config.js
pm2 list                      # 查看状态
pm2 logs openclaw-backend    # 查看日志
```

---

### Nginx配置（静态文件 + 反向代理）

```nginx
server {
    listen 3001;
    server_name 您的域名或IP;
    root /opt/openclaw_tool_server/frontend/dist;
    index index.html;

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1m;
        add_header Cache-Control "public, immutable";
    }

    # API反向代理
    location ^~ /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # SPA路由 fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 8. 重载Nginx
```bash
nginx -t
nginx -s reload
```

---

## 📌 腾讯云服务器注意事项

### 1. 安全组配置
- **必须开放** 网站监听的端口（如 3001）
- 后端API端口（3002）**不需要**开放到公网
- 通过Nginx反向代理访问后端

### 2. PM2进程管理
```bash
pm2 list                      # 查看所有进程
pm2 restart openclaw-backend # 重启后端
pm2 logs openclaw-backend    # 查看日志
pm2 flush                    # 清空日志
pm2 delete openclaw-backend  # 删除进程（慎用！）
```

### 3. 常见问题

**502 Bad Gateway**
- 检查Nginx是否运行：`ps aux | grep nginx`
- 检查后端是否运行：`pm2 status`
- 检查端口是否监听：`lsof -i:3001`

**数据库连接失败**
- 检查 `.env` 文件是否存在
- 检查 `DB_PASSWORD` 是否正确
- 重启后端：`pm2 restart openclaw-backend`

**端口被占用**
- 查看端口占用：`lsof -i:端口号`
- 释放端口或更换端口

### 4. 宝塔面板用户
- 可在宝塔界面配置PM2、Nginx、网站
- 也可使用命令行操作
- 配置文件位置：`/www/server/panel/vhost/nginx/`

---

## 📌 注意事项

1. **提交前务必检查** `git status`，确保不包含敏感信息
2. **不要强制推送** 到主分支，除非明确知道后果
3. **先拉取再推送**：`git pull --rebase` 可以保持提交历史整洁
4. **写清楚提交信息**：说明改了什么，为什么改
5. **频繁提交**：小步提交比一次性提交大量更改更好管理
