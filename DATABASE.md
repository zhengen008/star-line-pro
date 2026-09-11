# Starline OA 数据库管理指南

## 快速启动

### 1. 安装 Docker Desktop
下载并安装：https://www.docker.com/products/docker-desktop/

### 2. 启动数据库
```bash
# 启动 PostgreSQL 容器
docker-compose up -d

# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f postgres
```

### 3. 连接数据库
```bash
# 使用 Docker 内置客户端连接
docker exec -it starline-postgres psql -U starline_admin -d starline_oa

# 或使用 GUI 工具连接：
# Host: localhost
# Port: 5432
# User: starline_admin
# Password: starline2024
# Database: starline_oa
```

## 数据库配置

**连接字符串：**
```
postgresql://starline_admin:starline2024@localhost:5432/starline_oa
```

**容器信息：**
- 容器名称：`starline-postgres`
- 镜像：`postgres:15-alpine`
- 端口映射：`5432:5432`
- 数据持久化：`postgres_data` volume

## 常用命令

### Docker 操作
```bash
# 启动数据库
docker-compose up -d

# 停止数据库
docker-compose stop

# 停止并删除容器（数据不会丢失）
docker-compose down

# 完全清理（包括数据卷）
docker-compose down -v

# 重启数据库
docker-compose restart
```

### SQL 操作
```bash
# 执行 SQL 文件
docker exec -i starline-postgres psql -U starline_admin -d starline_oa < database/init.sql

# 导出数据库
docker exec starline-postgres pg_dump -U starline_admin starline_oa > backup.sql

# 导入数据库
docker exec -i starline-postgres psql -U starline_admin -d starline_oa < backup.sql
```

### Prisma 操作
```bash
# 安装 Prisma CLI
npm install -D prisma @prisma/client

# 生成 Prisma Client
npx prisma generate

# 同步数据库结构（开发环境）
npx prisma db push

# 打开数据库管理界面
npx prisma studio
```

## 数据库结构

共 14 张表：

| 表名 | 说明 |
|------|------|
| employees | 员工信息 |
| departments | 部门架构 |
| roles | 角色权限 |
| bids | 商机投标 |
| projects | 项目管理 |
| project_logs | 项目日志 |
| approvals | 审批流程 |
| project_approvals | 项目审批 |
| workflow_templates | 工作流模板 |
| notices | 公告通知 |
| notifications | 用户通知 |
| banners | 横幅轮播 |
| check_ins | 打卡记录 |
| memos | 备忘录便签 |

## GUI 工具推荐

1. **Prisma Studio**（推荐，内置）
   ```bash
   npx prisma studio
   ```

2. **pgAdmin**
   - 下载：https://www.pgadmin.org/download/

3. **DBeaver**
   - 下载：https://dbeaver.io/download/

4. **TablePlus**
   - 下载：https://tableplus.com/

## 故障排查

### 端口被占用
```bash
# 检查 5432 端口占用
netstat -ano | findstr :5432

# 修改 docker-compose.yml 中的端口映射
ports:
  - "5433:5432"  # 改用 5433
```

### 连接失败
```bash
# 检查容器状态
docker-compose ps

# 查看容器日志
docker-compose logs postgres

# 重启容器
docker-compose restart
```

### 重置数据库
```bash
# 停止并删除所有数据
docker-compose down -v

# 重新启动（会自动执行 init.sql）
docker-compose up -d
```

## 注意事项

⚠️ **生产环境部署时：**
1. 修改默认密码
2. 配置数据库备份策略
3. 启用 SSL 连接
4. 限制数据库访问 IP
5. 使用环境变量管理敏感信息
