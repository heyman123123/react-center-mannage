# Docker 单机部署

使用 Docker Compose 一键启动 PostgreSQL、Redis、API、**Worker**（定时任务）与 Nginx 静态前端，适合内部运营团队单机部署。

## 前置条件

- Docker Engine 20.10+
- Docker Compose v2+
- 主机开放端口 `3000`（管理端）、`8080`（API，可选直连）

## 首次启动

```bash
# 1. 复制环境变量模板
cp .env.docker.example .env

# 2. 编辑 .env（至少修改 NOVAS_JWT_SECRET）
# 生产环境建议：SEED_DEMO=false

# 3. 启动全部服务
make docker-up
# 或：docker compose up -d --build

# 4. 健康检查
curl -sf http://localhost:8080/healthz
curl -sf http://localhost:3000/healthz
```

浏览器访问 `http://localhost:3000`，使用默认管理员登录：

| 字段 | 值 |
|------|-----|
| 邮箱 | `admin@novaspay.global` |
| 密码 | `Admin@123456` |

**首次登录后请立即修改密码**（生产环境强制要求，见下方「生产部署检查清单」）。

## 生产部署检查清单

上线前请确认以下配置（`.env` 或 Compose 环境变量）：

| 项 | 要求 | 说明 |
|----|------|------|
| 默认密码 | **首次登录后立即修改** | 种子超管为 `admin@novaspay.global` / `Admin@123456`，仅用于初始化 |
| `NOVAS_JWT_SECRET` | 使用随机强密钥 | `openssl rand -base64 32` |
| `NOVAS_DATA_KEY` | 配置 32 字节 base64 | 加密渠道 ApiKey/WebhookSecret |
| `NOVAS_COOKIE_SECURE` | **`true`**（HTTPS 反代后） | 经 TLS 终结的 Nginx/Ingress 反代时启用；纯 HTTP 本地调试保持 `false` |
| `SEED_DEMO` | **`false`** | 不写入演示租户、支付应用、汇率等样本数据 |
| `NOVAS_CORS_ORIGINS` | 与实际访问域名一致 | 例如 `https://ops.example.com` |

HTTPS 反代示例：外层 Nginx 终结 TLS 并将 `X-Forwarded-Proto: https` 传给 NovasPay Web 容器后，在 `.env` 中设置：

```bash
NOVAS_COOKIE_SECURE=true
SEED_DEMO=false
NOVAS_CORS_ORIGINS=https://ops.example.com
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NOVAS_MODE` | API 运行模式 | `release` |
| `NOVAS_JWT_SECRET` | JWT 签名密钥 | 必须修改 |
| `NOVAS_COOKIE_SECURE` | Cookie Secure 标志（HTTPS 反代后设为 `true`） | `false` |
| `NOVAS_CORS_ORIGINS` | 允许的 CORS 来源 | `http://localhost:3000` |
| `SEED_DEMO` | 是否写入演示业务数据（租户、应用等） | `true` |
| `NOVAS_EMBEDDED_JOBS` | API 进程内是否跑渠道健康 goroutine；Compose 默认 `false`，由 `worker` 服务承担 | `false` |
| `POSTGRES_USER` | 数据库用户 | `novas` |
| `POSTGRES_PASSWORD` | 数据库密码 | `novas` |
| `POSTGRES_DB` | 数据库名 | `novaspay` |

### SEED_DEMO

- `true`（默认）：写入语言、菜单、超管及演示租户/支付应用/汇率等样本数据，便于内部体验。
- `false`：仅保留语言、菜单、超管与系统字典，不写入演示业务数据，适合生产首次部署。

## 常用命令

```bash
make docker-up      # 构建并后台启动
make docker-down    # 停止并移除容器（保留 pg_data 卷）
make docker-logs    # 查看最近 100 行并持续跟踪日志
```

## 修改密码与密钥

1. **管理员密码**：登录管理端后在用户管理中修改，或通过 API/数据库重置。
2. **JWT 密钥**：修改 `.env` 中 `NOVAS_JWT_SECRET` 后重启 `api` 服务：
   ```bash
   docker compose up -d --build api
   ```
3. **数据库密码**：修改 `.env` 中 `POSTGRES_PASSWORD` 与 `NOVAS_POSTGRES_DSN` 中对应字段，并同步更新 Postgres 容器环境变量（已有数据卷需手动 `ALTER USER`）。

生成随机密钥示例：

```bash
openssl rand -base64 32
```

## 数据备份

PostgreSQL 数据持久化在命名卷 `pg_data`：

```bash
# 查看卷名
docker volume ls | grep pg_data

# 逻辑备份
docker compose exec postgres pg_dump -U novas novaspay > backup-$(date +%Y%m%d).sql

# 恢复（空库或维护窗口）
cat backup.sql | docker compose exec -T postgres psql -U novas novaspay
```

## 升级镜像

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

仅升级 API 或 Web：

```bash
docker compose up -d --build api
docker compose up -d --build web
```

## 架构说明

```
浏览器 :3000
    └── web (Nginx)
            ├── /        → 静态资源 (Vite build)
            ├── /api/*   → 反代 api:8080
            └── /healthz → 反代 api:8080/healthz

api :8080
    ├── postgres:5432
    └── redis:6379
```

前端构建时 `VITE_API_BASE_URL=/api/v1`，与 Nginx 同源反代配合，Cookie 会话无需跨域配置。

## 常见问题

### 无法登录 / Cookie 未写入

- 确认通过 `http://localhost:3000` 访问（与 `NOVAS_CORS_ORIGINS` 一致）。
- HTTPS 反代后设置 `NOVAS_COOKIE_SECURE=true`。

### API 启动失败 / 数据库连接错误

```bash
docker compose logs api
docker compose ps
```

确认 `postgres` 健康检查通过后再启动 `api`。

### 端口冲突

修改 `docker-compose.yml` 中 `ports` 映射，例如 `"3001:3000"`，并同步更新 `NOVAS_CORS_ORIGINS`。

### 清空数据重新初始化

```bash
docker compose down -v   # 警告：删除 pg_data 卷
docker compose up -d --build
```
