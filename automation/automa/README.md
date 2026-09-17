# NovasPay 管理端 —— Automa 浏览器 RPA 自动化测试脚本

用途：使用你已经准备好的 **Creem 沙箱账号 / API Secret** 和 **Resend 账号 / API Key**，
通过浏览器插件 [Automa](https://www.automa.site/) 驱动一次真实浏览器会话，完整走一遍
**登录 → 创建 Creem 沙箱支付渠道 → 连通性测试 → Sandbox 测试下单 → 创建 Resend 邮件渠道 →
发送测试邮件** 的端到端 UI 冒烟测试，并对每一步的界面反馈做断言，失败时弹出通知提示。

本目录内容：

| 文件 | 说明 |
|------|------|
| `novaspay-automa-workflow.json` | 可直接导入 Automa 的工作流文件（46 个节点 / 49 条连线） |
| `generate_workflow.py` | 生成上述 JSON 的 Python 脚本（用于二次开发/维护，非必需） |

与 `backend/scripts/e2e_channel_email_test.sh`（纯 API 层面的后端自动化测试）互补：
这套 Automa 脚本额外覆盖了**真实浏览器 UI 交互**（表单渲染、按钮点击、Toast 文案展示）这一层，
两者结合可以同时验证后端接口和前端页面。

## 1. 安装 Automa

1. 打开 Chrome / Edge 应用商店，搜索并安装 [Automa](https://chromewebstore.google.com/detail/automa/infppggnoaenmfagbfknfkancpbljcca) 扩展。
2. 安装完成后点击浏览器工具栏的 Automa 图标，确认扩展已启用。

## 2. 导入工作流

1. 打开 Automa 面板 → **Workflows** → 右上角 **Import** → 选择本目录下的
   `novaspay-automa-workflow.json`。
2. 导入成功后会看到一个名为 **「NovasPay - 渠道与邮件配置自动化测试」** 的工作流，
   打开可以看到 46 个节点组成的流程图（happy path 一条主线 + 5 个校验节点的失败分支）。

## 3. 配置你的真实账号信息（Global Data）

工作流的所有可变配置都集中在 Automa 的 **Global Data**（全局数据）里，不需要修改工作流本身。

1. 在工作流编辑页面，点击右侧 **Global data** 标签页。
2. 会看到如下 JSON（已内置为占位符，需要你替换成真实值）：

```json
{
  "baseUrl": "http://localhost:3000",
  "adminEmail": "admin@novaspay.global",
  "adminPassword": "Admin@123456",
  "creemMode": "sandbox",
  "creemAccountName": "Automa 自动化测试账户",
  "creemApiSecret": "REPLACE_WITH_YOUR_CREEM_SANDBOX_API_SECRET",
  "creemWebhookSecret": "",
  "creemProductId": "REPLACE_WITH_YOUR_CREEM_PRODUCT_ID_prod_xxx",
  "creemCustomerEmail": "tester@novaspay.global",
  "emailChannelName": "Automa 自动化测试-邮件渠道",
  "resendApiKey": "REPLACE_WITH_YOUR_RESEND_API_KEY",
  "resendSenderEmail": "REPLACE_WITH_YOUR_RESEND_VERIFIED_SENDER@yourdomain.com",
  "resendSenderName": "Novas Notifications (Automa Test)",
  "testRecipientEmail": "REPLACE_WITH_RECIPIENT_TO_RECEIVE_TEST_EMAIL@example.com",
  "cleanupAfterTest": true
}
```

3. 逐项替换为你自己的账号信息：

   | 字段 | 说明 |
   |------|------|
   | `baseUrl` | 管理端前端地址（含协议+端口，不带 `#`），例如 `http://localhost:3000` |
   | `adminEmail` / `adminPassword` | 管理端登录账号 |
   | `creemMode` | `sandbox`（沙箱，推荐）或 `live` |
   | `creemAccountName` | 本次测试创建的渠道名称（用于 UI 选择器定位卡片，保持唯一即可） |
   | `creemApiSecret` | 你在 Creem 控制台获取的 Sandbox API Secret |
   | `creemWebhookSecret` | 可选，Creem Webhook 签名密钥 |
   | `creemProductId` | 你在 Creem 后台已创建的商品 ID（`prod_xxx`），用于 Sandbox 下单测试 |
   | `creemCustomerEmail` | Sandbox 测试下单时使用的客户邮箱（可选） |
   | `emailChannelName` | 本次测试创建的邮件渠道名称 |
   | `resendApiKey` | 你在 Resend 控制台获取的 API Key |
   | `resendSenderEmail` | 已在 Resend 完成域名校验的发件邮箱 |
   | `resendSenderName` | 发件人展示名称 |
   | `testRecipientEmail` | 用于接收测试邮件的真实邮箱地址 |
   | `cleanupAfterTest` | `true` 时测试成功后会自动删除本次创建的 Creem 渠道；`false` 则保留，便于排查 |

   > 提示：Global Data 只保存在你本机的 Automa 扩展数据里，**不会**被提交到 Git 仓库，
   > 请放心填写真实密钥。工作流文件本身（`novaspay-automa-workflow.json`）里的
   > `globalData` 字段仍然是占位符，可以安全地留在仓库中共享给团队其他成员。

4. 点击右上角 **Save** 保存配置。

## 4. 运行

1. 确保管理端前端（`baseUrl`）与后端服务均已启动，且可以正常访问。
2. 回到 Automa 工作流页面，点击右上角的 **▶ Execute** 按钮。
3. Automa 会自动打开一个新标签页，依次执行：
   - 强制登出（清理旧会话，保证幂等）→ 重新打开登录页 → 填写账号密码登录；
   - 通过后台 `fetch` 调用（携带已登录的 Cookie 会话）创建 Creem 沙箱支付渠道；
   - 跳转到「支付渠道」页，校验新渠道卡片已显示，点击「测试连通性」并校验
     「API 握手成功」提示；
   - 跳转到「邮件渠道」页，通过 UI 表单创建 Resend 发件渠道，校验「已成功添加」提示；
   - 点击「发测试信」，填写收件邮箱并发送，校验「测试邮件投递成功」提示；
   - 返回「支付渠道」页，点击该 Creem 渠道的「测试交易」，填写商品 ID 执行
     **Sandbox 测试下单**，校验「Checkout 已创建」提示；
   - 汇总结果，按 `cleanupAfterTest` 决定是否删除测试渠道，并弹出最终通知。
4. 执行过程中和结束后，都可以在 Automa 的 **Logs**（日志）页签查看每个节点的详细执行
   结果、截图与耗时，用于排查问题。

## 5. 校验节点与失败分支

流程中共有 5 个 `element-exists` 校验节点（渠道卡片显示、连通性测试成功、邮件渠道创建成功、
测试邮件发送成功、Checkout 创建成功）。每个校验节点有两个输出：

- 输出 1（找到元素 / 校验通过）→ 继续主流程；
- 输出 2（超时未找到 / 校验失败）→ 汇聚到统一的失败通知节点，弹出
  「❌ NovasPay 自动化测试步骤失败」，提示你去 Automa 日志定位具体失败原因。

## 6. 常见问题排查

- **选择器匹配不到元素 / 全部卡在某一步**：工作流内的按钮、Toast 文案选择器均按管理端
  默认语言（简体中文 `zh-CN`）编写，例如 `button:contains("测试连通性")`。如果你的浏览器
  /账号切换成了其他界面语言，需要同步修改工作流里对应节点的 `selector` 字段文案。
- **登录失败**：检查 `adminEmail` / `adminPassword` 是否正确，以及后端服务、数据库、
  Redis 是否已启动（可访问 `{baseUrl 对应后端}/healthz`、`/readyz` 确认）。
- **Creem 连通性测试 / Sandbox 下单失败**：检查 `creemApiSecret` 是否为有效的 Sandbox
  密钥，`creemProductId` 是否是该 Creem 账号下真实存在的商品 ID。
- **Resend 发信失败**：检查 `resendApiKey` 是否有效，`resendSenderEmail` 是否已经在
  Resend 控制台完成域名验证（未验证域名的发件地址会被 Resend 拒绝）。
- **想保留现场排查，而不是自动清理**：把 Global Data 中的 `cleanupAfterTest` 改成
  `false` 后重新运行；排查完毕后手动在「支付渠道」页删除测试渠道即可。
- **选择器使用了 `:contains()` / `:has()` 伪类**：这是 Automa 内置的 Sizzle 选择器引擎
  支持的 jQuery 风格扩展语法，不是标准 CSS，若要在浏览器 DevTools 里手动验证选择器，
  需要改用 `document.querySelectorAll` 无法直接识别这些伪类，属正常现象。

## 7. 二次开发（可选）

如果需要调整流程（比如新增一个渠道、修改文案选择器、调整等待时长），推荐直接编辑
`generate_workflow.py` 中对应的节点定义后重新生成：

```bash
python3 generate_workflow.py
```

生成的文件会写到脚本同目录下的 `novaspay-automa-workflow.json`（覆盖当前文件），
之后重新导入 Automa 即可生效。也可以不使用生成脚本，直接在 Automa 可视化编辑器里
拖拽修改，完成后用 **Export** 导出覆盖本文件，方便团队共享。
