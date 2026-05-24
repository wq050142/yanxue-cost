# 腾讯云部署指南

本文档提供将研学旅行成本核算系统部署到腾讯云的完整步骤。

## 前置条件

1. 拥有腾讯云账号
2. 已开通 Supabase 服务并获取连接信息
3. 已安装 Git

## 方案一：腾讯云云托管（推荐）

腾讯云云托管（CloudBase Run）是 Serverless 容器服务，无需管理服务器。

### 步骤 1：开通云托管服务

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 搜索「云托管」或访问 [CloudBase 控制台](https://console.cloud.tencent.com/tcb)
3. 创建新环境，选择「按量计费」模式

### 步骤 2：连接代码仓库

1. 在云托管控制台选择「新建服务」
2. 选择「GitHub」或「GitLab」作为代码来源
3. 授权并选择你的项目仓库
4. 选择分支（通常为 main）

### 步骤 3：配置构建设置

```
构建类型：Dockerfile
Dockerfile 路径：./Dockerfile
```

### 步骤 4：配置环境变量

在「高级配置」中添加环境变量：

| 变量名 | 变量值 | 说明 |
|--------|--------|------|
| `COZE_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase 项目 URL |
| `COZE_SUPABASE_ANON_KEY` | `eyJhbGci...` | Supabase 匿名密钥 |
| `NODE_ENV` | `production` | 生产环境标识 |
| `PORT` | `5000` | 服务端口 |

### 步骤 5：部署

1. 点击「开始部署」
2. 等待构建完成（约 3-5 分钟）
3. 部署成功后会获得访问域名

---

## 方案二：腾讯云 CVM（云服务器）

适合需要完全控制服务器的场景。

### 步骤 1：购买云服务器

1. 访问 [CVM 购买页面](https://buy.cloud.tencent.com/cvm)
2. 推荐配置：
   - 地域：选择离用户最近的区域
   - 机型：2核4G（入门级）
   - 镜像：Ubuntu 22.04 或 CentOS 8
   - 带宽：按需选择（建议 3Mbps 以上）

### 步骤 2：连接服务器

```bash
# 使用 SSH 连接
ssh root@你的服务器IP
```

### 步骤 3：安装 Docker

```bash
# Ubuntu
apt update
apt install -y docker.io docker-compose

# CentOS
yum install -y docker docker-compose

# 启动 Docker
systemctl start docker
systemctl enable docker
```

### 步骤 4：克隆代码

```bash
# 安装 Git
apt install -y git  # Ubuntu
# yum install -y git  # CentOS

# 克隆项目
git clone https://github.com/你的用户名/你的仓库.git
cd 你的仓库
```

### 步骤 5：配置环境变量

```bash
# 创建环境变量文件
cat > .env << 'EOF'
COZE_SUPABASE_URL=https://your-project.supabase.co
COZE_SUPABASE_ANON_KEY=your-anon-key
NODE_ENV=production
PORT=5000
EOF
```

### 步骤 6：构建并运行

```bash
# 构建 Docker 镜像
docker build -t study-tour-app .

# 运行容器
docker run -d \
  --name study-tour \
  -p 5000:5000 \
  --env-file .env \
  --restart unless-stopped \
  study-tour-app
```

### 步骤 7：配置域名（可选）

1. 在腾讯云 DNS 解析中添加 A 记录
2. 指向服务器 IP
3. 配置 HTTPS（推荐使用腾讯云免费 SSL 证书）

---

## 方案三：使用 PM2 部署（非 Docker）

适合不想使用 Docker 的场景。

### 步骤 1-3：同方案二（购买服务器、连接、克隆代码）

### 步骤 4：安装 Node.js

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# 安装 Node.js 20
nvm install 20
nvm use 20

# 安装 pnpm
npm install -g pnpm
```

### 步骤 5：安装依赖并构建

```bash
cd 你的仓库

# 配置环境变量
export COZE_SUPABASE_URL=https://your-project.supabase.co
export COZE_SUPABASE_ANON_KEY=your-anon-key

# 安装依赖
pnpm install

# 构建
pnpm run build
```

### 步骤 6：安装并配置 PM2

```bash
# 安装 PM2
npm install -g pm2

# 创建 PM2 配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'study-tour',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 5000',
    env: {
      NODE_ENV: 'production',
      COZE_SUPABASE_URL: 'https://your-project.supabase.co',
      COZE_SUPABASE_ANON_KEY: 'your-anon-key',
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
  }]
}
EOF

# 启动应用
pm2 start ecosystem.config.js

# 设置开机自启
pm2 startup
pm2 save
```

---

## 配置 Nginx 反向代理（推荐）

无论使用哪种方案，都建议配置 Nginx 作为反向代理。

```bash
# 安装 Nginx
apt install -y nginx  # Ubuntu

# 创建配置
cat > /etc/nginx/sites-available/study-tour << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
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
nginx -t
systemctl restart nginx
```

---

## 获取 Supabase 连接信息

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 进入 Settings → API
4. 复制以下信息：
   - **Project URL** → `COZE_SUPABASE_URL`
   - **anon public key** → `COZE_SUPABASE_ANON_KEY`

---

## 常见问题

### 1. 部署后页面空白

检查环境变量是否正确配置：
```bash
docker logs study-tour  # Docker 部署
pm2 logs study-tour     # PM2 部署
```

### 2. 数据库连接失败

确认 Supabase URL 和 Key 正确，检查网络连接。

### 3. 端口被占用

```bash
# 查看端口占用
lsof -i:5000
# 结束进程
kill -9 <PID>
```

---

## 费用估算

| 方案 | 月费用（约） | 说明 |
|------|-------------|------|
| 云托管 | ¥50-200 | 按实际使用量计费 |
| CVM 2核4G | ¥80-150 | 包年更优惠 |
| Supabase | 免费/¥25 | 免费版有额度限制 |

---

## 技术支持

如有问题，请检查：
1. 环境变量是否正确配置
2. 服务器防火墙是否开放 5000 端口
3. Docker/PM2 进程是否正常运行
