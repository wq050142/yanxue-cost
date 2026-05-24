# 腾讯云轻量应用服务器部署指南

本文档适用于在已有的腾讯云轻量应用服务器上部署研学旅行成本核算系统。

## 前置准备

### 1. 获取服务器信息

登录 [腾讯云轻量应用服务器控制台](https://console.cloud.tencent.com/lighthouse)，记录以下信息：
- 服务器公网 IP
- 当前操作系统
- 已安装的应用（如 Nginx、Node.js 等）

### 2. 连接服务器

**方式一：控制台 WebShell**
1. 在服务器列表点击「登录」按钮
2. 使用 WebShell 直接连接

**方式二：本地 SSH 连接**
```bash
ssh root@你的服务器IP
# 或使用腾讯云默认用户
ssh ubuntu@你的服务器IP  # Ubuntu 系统
ssh lighthouse@你的服务器IP  # 腾讯云默认用户
```

---

## 情况一：服务器已安装 Nginx + Node.js

如果你的服务器已经部署过 Node.js 网站：

### 1. 检查当前环境

```bash
# 查看 Node.js 版本
node -v

# 查看 Nginx 状态
systemctl status nginx

# 查看当前运行的 Node 进程
pm2 list
```

### 2. 创建项目目录

```bash
# 创建新项目目录
mkdir -p /www/study-tour
cd /www/study-tour
```

### 3. 上传代码

**方式一：Git 克隆（推荐）**
```bash
# 如果服务器可以访问 GitHub
git clone https://github.com/你的用户名/你的仓库.git .
```

**方式二：本地打包上传**
```bash
# 在本地项目目录执行
pnpm run build
tar -czvf study-tour.tar.gz .next public package.json pnpm-lock.yaml

# 上传到服务器
scp study-tour.tar.gz root@你的服务器IP:/www/study-tour/
```

### 4. 安装依赖并启动

```bash
cd /www/study-tour

# 配置环境变量
export COZE_SUPABASE_URL=https://your-project.supabase.co
export COZE_SUPABASE_ANON_KEY=your-anon-key

# 安装依赖
pnpm install --prod

# 使用 PM2 启动（端口 5001，避免冲突）
pm2 start npm --name "study-tour" -- run start -- -p 5001

# 保存 PM2 配置
pm2 save
```

### 5. 配置 Nginx 反向代理

```bash
# 创建 Nginx 配置
cat > /etc/nginx/sites-available/study-tour << 'EOF'
server {
    listen 80;
    server_name study-tour.your-domain.com;  # 替换为你的域名

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# 启用配置
ln -s /etc/nginx/sites-available/study-tour /etc/nginx/sites-enabled/

# 测试并重载 Nginx
nginx -t
systemctl reload nginx
```

---

## 情况二：服务器是纯净系统

如果服务器是新安装的系统，没有 Web 环境：

### 1. 安装 Node.js 和 PM2

```bash
# 安装 Node.js 20（Ubuntu/Debian）
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 安装 pnpm
npm install -g pnpm

# 安装 PM2
npm install -g pm2
```

### 2. 安装 Nginx

```bash
# Ubuntu/Debian
apt update
apt install -y nginx

# 启动 Nginx
systemctl start nginx
systemctl enable nginx
```

### 3. 部署项目

参考「情况一」的步骤 3-5。

---

## 情况三：使用 Docker 部署（推荐）

如果你的服务器安装了 Docker：

### 1. 检查 Docker

```bash
docker -v
docker-compose -v
```

### 2. 创建项目目录

```bash
mkdir -p /www/study-tour
cd /www/study-tour
```

### 3. 创建环境变量文件

```bash
cat > .env << 'EOF'
COZE_SUPABASE_URL=https://your-project.supabase.co
COZE_SUPABASE_ANON_KEY=your-anon-key
NODE_ENV=production
PORT=5000
EOF
```

### 4. 上传 Dockerfile 和代码

```bash
# 克隆代码或上传文件
git clone https://github.com/你的用户名/你的仓库.git .

# 构建镜像
docker build -t study-tour-app .

# 运行容器
docker run -d \
  --name study-tour \
  -p 5000:5000 \
  --env-file .env \
  --restart unless-stopped \
  study-tour-app
```

---

## 配置域名和 HTTPS

### 1. 解析域名

在腾讯云 DNS 解析中添加 A 记录：
- 主机记录：`study-tour`（或 `@` 用于根域名）
- 记录类型：A
- 记录值：服务器公网 IP

### 2. 申请免费 SSL 证书

```bash
# 安装 certbot
apt install -y certbot python3-certbot-nginx

# 申请证书
certbot --nginx -d study-tour.your-domain.com

# 自动续期
certbot renew --dry-run
```

---

## 常用命令

```bash
# 查看应用状态
pm2 status

# 查看日志
pm2 logs study-tour

# 重启应用
pm2 restart study-tour

# 查看 Docker 容器状态
docker ps
docker logs study-tour

# 重启 Nginx
systemctl restart nginx
```

---

## 防火墙设置

确保服务器防火墙开放必要端口：

```bash
# 腾讯云轻量服务器需要在控制台配置防火墙规则
# 开放端口：
# - 80 (HTTP)
# - 443 (HTTPS)
# - 22 (SSH)
```

在腾讯云控制台 → 轻量应用服务器 → 选择服务器 → 防火墙 → 添加规则

---

## 一键部署脚本

创建自动化部署脚本：

```bash
#!/bin/bash
# 部署脚本 - deploy.sh

PROJECT_DIR="/www/study-tour"
GIT_REPO="https://github.com/你的用户名/你的仓库.git"

echo "开始部署..."

# 进入项目目录
cd $PROJECT_DIR

# 拉取最新代码
git pull origin main

# 安装依赖
pnpm install --prod

# 重启服务
pm2 restart study-tour

echo "部署完成！"
```

使用方法：
```bash
chmod +x deploy.sh
./deploy.sh
```
