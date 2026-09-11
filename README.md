# Starline B2B OA（Octopus）

公司内部项目管理平台：员工/部门/权限管理、竞标商务管理、项目管理与统计、审批中心与工作流、公告通知中心、飞书 OAuth 登录与消息推送。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + Vite 6 + Tailwind CSS + shadcn/ui + TanStack Query + react-router-dom |
| 后端 | Node.js + Express + Prisma 5 |
| 数据库 | PostgreSQL 15（Docker Compose） |
| 认证 | 飞书 OAuth 2.0（JWT 7 天有效期） |
| 文件存储 | 阿里云 OSS（`server/src/functions/ossUpload.js`） |

## 目录结构

```
├── src/                  # 前端（React + Vite）
│   ├── api/client.js     # API 客户端（entities 通用 CRUD、functions、auth、上传）
│   ├── lib/AuthContext.jsx  # 飞书认证上下文（权限判断 can/isAdmin/...）
│   ├── pages/            # 15 个业务页面
│   └── components/       # UI 组件（shadcn/ui + 业务组件）
├── server/               # 后端（Express + Prisma）
│   ├── prisma/schema.prisma  # 数据库模型（唯一真相源，根目录 prisma/ 为同步副本）
│   ├── src/routes/       # entities 通用 CRUD / functions / auth 路由
│   ├── src/functions/    # 业务函数（唯一实现，前端经 /api/functions/:name 调用）
│   └── src/lib/feishu.js # 飞书 token 缓存 + 互动卡片推送
├── prisma/schema.prisma  # 与 server/prisma/schema.prisma 保持一致（同步副本）
└── database/init.sql     # 数据库初始化脚本（Docker 首次启动自动执行）
```

## 本地开发

### 1. 启动数据库

```bash
docker-compose up -d          # 启动 PostgreSQL（首次会自动执行 database/init.sql）
docker-compose ps             # 查看状态
```

### 2. 启动后端（端口 3001）

```bash
cd server
npm install
npm run dev                   # node --watch，改代码自动重启
```

### 3. 启动前端（端口 5173，/api 代理到 3001）

```bash
npm install
npm run dev
```

## 环境变量

- `server/.env`：`DATABASE_URL`、`JWT_SECRET`、`FEISHU_APP_ID/SECRET`、`OSS_*`（阿里云 OSS）
- `.env.local`：`VITE_API_BASE=/api`（前端 API 前缀，Vite 代理到 3001）

## 数据库

- 共 14 张表（详见 `DATABASE.md`）：employees / departments / roles / bids / projects / project_logs / approvals / project_approvals / workflow_templates / notices / notifications / banners / check_ins / memos
- Schema 唯一真相源：`server/prisma/schema.prisma`。修改模型后执行：
  ```bash
  cd server
  npx prisma generate   # 重新生成 Client
  npx prisma db push    # 同步数据库结构
  ```
- 根目录 `prisma/schema.prisma` 是同步副本，修改后记得 `Copy-Item server\prisma\schema.prisma prisma\schema.prisma` 保持一致。

## 业务函数约定

所有业务函数（飞书认证/组织同步、审批与项目变更通知、公告推送、OSS 上传等）的**唯一实现**在 `server/src/functions/`，前端通过 `api.functions.invoke('函数名', data)` 调用。
