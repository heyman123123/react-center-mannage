# NovasPay Admin API

一期平台后端：IAM（Cookie 会话）+ 菜单/角色/用户/部门 + 字典。

## 快速启动（推荐 Make）

```bash
cd backend
make help   # 查看全部目标
make run    # 拉起 PG/Redis + 编译并启动 API（:8080）
```

常用：

| 命令 | 作用 |
|------|------|
| `make up` | 仅启动 Postgres(5433) + Redis(6380) |
| `make run` | up + 编译 `bin/api` 并前台启动 |
| `make stop` | 结束占用 `:8080` 的进程 |
| `make status` | 健康检查 |
| `make down` | 停止 compose |

- Health: `GET http://localhost:8080/healthz`
- API 前缀: `/api/v1`

默认管理员（首次启动种子）：`admin@novaspay.global` / `Admin@123456`

## 前端联调

仓库根目录 `.env`（可参考 `.env.example`）：

```bash
VITE_USE_MOCK=false
VITE_API_BASE_URL=/api/v1
```

Vite 将 `/api` 代理到 `http://127.0.0.1:8080`，Cookie 同源落在 `:3000`。

```bash
# 终端 1
cd backend && make run

# 终端 2
npm run dev
```

## Cookie / CORS

- Cookie：`novas_access` / `novas_refresh`，HttpOnly；响应 JSON **无** token
- 直连后端时 CORS Origin 白名单含 `http://localhost:3000`
- 本地推荐走 Vite 代理，不必直连跨端口

## 环境变量

| 变量 | 默认 |
|------|------|
| `NOVAS_HTTP_ADDR` | `:8080` |
| `NOVAS_POSTGRES_DSN` | port=`5433`（compose） |
| `NOVAS_REDIS_ADDR` | `127.0.0.1:6380` |
| `NOVAS_CORS_ORIGINS` | localhost:3000 / 5173 |
