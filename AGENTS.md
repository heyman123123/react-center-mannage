# AGENTS.md — NovasPay 管理端协作约定

面向在本仓库工作的编码 Agent / 协作者。改 UI 文案或鉴权相关代码前先读本节。

## i18n（强制）

**所有用户可见 UI 文案必须走 i18n**，禁止在组件里硬编码中文或英文界面文案。

| 做 | 不做 |
|----|------|
| `const { t } = useTranslation('dashboard');` 后用 `t('kpi.totalRevenue')` | `<span>总收入</span>` / `"Total Revenue"` 写死在 TSX |
| 新文案写入 `src/locales/zh-CN/<namespace>.json`，再在组件引用 | 只改组件字符串、不补语言包 |
| Toast / 空状态 / 表头 / 按钮 / placeholder / title / aria-label 一律 `t()` | 在组件里硬编码 UI 文案 |
| 插值用 `t('key', { count })` | 字符串拼接拼出整句 UI 文案 |

### 范围（方案 A）

- **必须 i18n**：按钮、标题、Tab、表头、Toast、空状态、表单 label/placeholder、确认框、侧栏用户菜单、登录页等壳层文案。
- **不必 i18n**：后端下发的业务数据（订单标题、商户名、审计详情原文、字典词条内容、菜单树由配置下发的 `title` 等）。配置型菜单若改为前端写死展示名，则仍须走 i18n。

### 目录与用法

- 初始化：`src/i18n/index.ts`（在 `main.tsx` 最先 import）
- 语言包：`src/locales/zh-CN/*.json`，经 `src/locales/zh-CN/index.ts` 汇总
- 默认语言：`zh-CN`；新增语言时平行增加 locale 目录并在 `i18n` 注册
- 命名空间按功能拆分（`common` / `auth` / `nav` / `dashboard` / …）；跨页复用放 `common`
- 键名：点分语义路径，如 `dashboard:kpi.totalRevenue`，勿用无意义序号

### 完成标准（改文案时自检）

1. 目标界面上已无硬编码 UI 壳层字符串（可用搜索中文标点/常见英文 UI 词抽查）。
2. 对应 key 已出现在 `src/locales/zh-CN/`。
3. `npx tsc --noEmit` 通过。

## 鉴权（Cookie 会话）

- 后端以 **HttpOnly Cookie** 下发会话；响应 JSON **不得**含 access/refresh token。
- 前端 **禁止** 读写删会话 Cookie，**禁止** localStorage/sessionStorage 存 token。
- 请求统一 `credentials: 'include'`（见 `src/api/request.ts`）。
- 登出只调后端 logout；会话探测见 `src/lib/auth.ts`。
- 细节见 `docs/backend-architecture.md` §6、`docs/backend-technical.md` §7。

## 其它

- 回复用户用简体中文（若用户规则要求）。
- 未要求勿擅自 git commit / push。
