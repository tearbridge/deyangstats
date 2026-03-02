# 德阳 Stats — WoW Mythic+ Tracker

魔兽世界大秘境（M+）小队追踪网站，数据来源 [Raider.IO](https://raider.io)。

## 功能

- 🏆 **排行榜**：按 M+ 评分排序，卡片展示角色信息、评分、本周最高层数
- 📊 **角色详情**：本赛季最高记录、最近跑本、评分历史折线图
- ⚙️ **管理面板**：添加/删除角色，需要 admin token
- 🔄 **自动刷新**：每小时从 Raider.IO 拉取最新数据缓存到 SQLite

## 技术栈

- **前端**：React + Vite + Tailwind CSS + daisyUI（dracula 主题）
- **后端**：Node.js + Express + SQLite（better-sqlite3）
- **数据源**：Raider.IO 公开 API（免费，无需 key）
- **进程管理**：PM2

## 本地开发

### 后端

```bash
cd backend
cp .env.example .env   # 编辑 .env 设置 ADMIN_TOKEN
npm install
npm run dev            # 跑在 :3001
```

### 前端

```bash
cd frontend
npm install
npm run dev            # 跑在 :5173，/api 代理到 :3001
```

## 服务器部署

### 环境要求

- Node.js 18+
- PM2（`npm install -g pm2`）
- Nginx
- Git

### 首次部署

```bash
# 1. 克隆代码
git clone https://github.com/tearbridge/deyangstats.git /var/www/deyangstats
cd /var/www/deyangstats

# 2. 配置后端环境变量
cp backend/.env.example backend/.env
nano backend/.env    # 设置 PORT 和 ADMIN_TOKEN

# 3. 创建数据目录
mkdir -p data

# 4. 安装依赖 & 启动后端
cd backend && npm install --production
pm2 start src/server.js --name deyangstats-backend
pm2 save
pm2 startup

# 5. 构建前端
cd ../frontend && npm install && npm run build

# 6. 配置 Nginx（见下方）
```

### Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    root /var/www/deyangstats/frontend/dist;
    index index.html;

    # SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 后续更新

```bash
cd /var/www/deyangstats
bash scripts/deploy.sh
```

## API

| 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/characters` | 获取所有角色及最新数据 | 无 |
| POST | `/api/characters` | 添加角色 | Admin Token |
| DELETE | `/api/characters/:id` | 删除角色 | Admin Token |
| GET | `/api/characters/:id` | 获取单个角色完整数据 | 无 |
| GET | `/api/characters/:id/history` | 评分历史 | 无 |
| POST | `/api/characters/:id/refresh` | 手动刷新数据 | Admin Token |

Admin Token 通过请求头 `X-Admin-Token` 传递。

## 环境变量（backend/.env）

```
PORT=3001
ADMIN_TOKEN=changeme    # 修改为安全的 token
DB_PATH=../data/deyangstats.db  # 可选，默认 data/deyangstats.db
```

## 数据说明

- 数据每小时自动从 Raider.IO 拉取一次
- 服务启动后 5 秒会触发一次初始拉取
- 管理页添加角色后立即触发后台拉取
- 历史快照保存在 SQLite，可用于绘制评分趋势图
