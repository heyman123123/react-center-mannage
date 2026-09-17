#!/usr/bin/env python3
"""Generate the NovasPay Automa workflow JSON deterministically.

This script is NOT part of the deliverable; it's a scratch helper used to
hand-build a syntactically-correct Automa workflow export (drawflow graph of
nodes + vue-flow style edges) without manually typing hundreds of lines of
nested JSON.
"""
import json
import time

NODES = []
EDGES = []
NODE_INDEX = {}
X_STEP = 260
Y_BASE = 300


def add_node(node_id, label, data, extra=None, x=None, y=Y_BASE):
    idx = len(NODES)
    node = {
        "id": node_id,
        "label": label,
        "type": (extra or {}).get("component", "BlockBasic"),
        "position": {"x": x if x is not None else 100 + idx * X_STEP, "y": y},
        "data": data,
    }
    NODES.append(node)
    NODE_INDEX[node_id] = node
    return node_id


def add_edge(source, target, source_output=1, target_input=1):
    source_handle = f"{source}-output-{source_output}"
    target_handle = f"{target}-input-{target_input}"
    edge_id = f"vueflow__edge-{source}{source_handle}-{target}{target_handle}"
    EDGES.append(
        {
            "id": edge_id,
            "source": source,
            "sourceHandle": source_handle,
            "target": target,
            "targetHandle": target_handle,
            "type": "custom",
            "markerEnd": "arrowclosed",
            "data": {},
        }
    )


def base_data(description="", **overrides):
    d = {"disableBlock": False, "description": description}
    d.update(overrides)
    return d


def forms_data(selector, value, description, find_by="cssSelector",
                wait=False, wait_timeout=5000, clear=True, ftype="text-field"):
    return base_data(
        description,
        findBy=find_by,
        waitForSelector=wait,
        waitSelectorTimeout=wait_timeout,
        selector=selector,
        markEl=False,
        multiple=False,
        selected=True,
        clearValue=clear,
        getValue=False,
        saveData=False,
        dataColumn="",
        selectOptionBy="value",
        optionPosition="1",
        assignVariable=False,
        variableName="",
        type=ftype,
        value=value,
        delay=0,
        events=[],
    )


def click_data(selector, description, find_by="cssSelector", wait=False, wait_timeout=5000):
    return base_data(
        description,
        findBy=find_by,
        waitForSelector=wait,
        waitSelectorTimeout=wait_timeout,
        selector=selector,
        markEl=False,
        multiple=False,
    )


def delay_data(ms, description):
    return base_data(description, time=ms)


def new_tab_data(url, description, update_prev=False, wait_loaded=True):
    return base_data(
        description,
        url=url,
        userAgent="",
        active=True,
        tabZoom=1,
        inGroup=False,
        waitTabLoaded=wait_loaded,
        updatePrevTab=update_prev,
        customUserAgent=False,
    )


def element_exists_data(selector, description, try_count=6, timeout=1000, find_by="cssSelector"):
    return base_data(
        description,
        findBy=find_by,
        selector=selector,
        tryCount=try_count,
        timeout=timeout,
        markEl=False,
        throwError=False,
    )


def js_data(code, description, timeout=20000):
    return base_data(
        description,
        timeout=timeout,
        context="website",
        code=code,
        preloadScripts=[],
        everyNewTab=False,
        runBeforeLoad=False,
    )


def notification_data(title, message, description=""):
    return base_data(description, message=message, iconUrl="", imageUrl="", title=title)


# ---------------------------------------------------------------------------
# Node type -> component map (needed for the "type" field Automa expects,
# mirroring src/utils/shared.js `tasks[...].component`)
# ---------------------------------------------------------------------------
COMPONENT = {
    "trigger": "BlockBasic",
    "new-tab": "BlockBasic",
    "delay": "BlockDelay",
    "forms": "BlockBasic",
    "event-click": "BlockBasic",
    "element-exists": "BlockElementExists",
    "javascript-code": "BlockBasic",
    "notification": "BlockBasic",
}


def block(node_id, label, data, x=None, y=Y_BASE):
    return add_node(node_id, label, data, extra={"component": COMPONENT[label]}, x=x, y=y)


LOGOUT_JS = """(async () => {
  const cfg = automaRefData('globalData') || {};
  const base = (cfg.baseUrl || '').replace(/\\/$/, '');
  try {
    await fetch(base + '/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
  } catch (e) {
    console.warn('[NovasPay E2E] logout skipped:', e.message);
  } finally {
    automaNextBlock();
  }
})();
"""

CREATE_CREEM_JS = """(async () => {
  const cfg = automaRefData('globalData') || {};
  const base = (cfg.baseUrl || '').replace(/\\/$/, '');
  const summary = { step: 'create_creem_channel' };
  try {
    const res = await fetch(base + '/api/v1/payment-channels', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelKey: 'creem',
        name: cfg.creemAccountName || 'Automa 自动化测试账户',
        accountName: cfg.creemAccountName || '',
        description: 'Automa RPA 自动化测试创建，可安全删除',
        mode: cfg.creemMode || 'sandbox',
        apiSecretKey: cfg.creemApiSecret,
        webhookSecret: cfg.creemWebhookSecret || '',
        supportedCurrencies: ['USD'],
        feeRateText: 'Automa Test',
        routingPriority: 99,
      }),
    });
    const json = await res.json();
    summary.httpStatus = res.status;
    summary.response = json;
    if (res.ok && json && json.code === 0 && json.data && json.data.id) {
      automaSetVariable('creemChannelId', json.data.id);
      automaSetVariable('creemChannelOk', true);
    } else {
      automaSetVariable('creemChannelOk', false);
    }
  } catch (e) {
    summary.error = e.message;
    automaSetVariable('creemChannelOk', false);
  }
  automaSetVariable('creemCreateSummary', JSON.stringify(summary, null, 2));
  automaNextBlock();
})();
"""

CLEANUP_JS = """(async () => {
  const cfg = automaRefData('globalData') || {};
  const channelId = automaRefData('variables', 'creemChannelId');
  const result = { cleanedUp: false, channelId: channelId || null };
  try {
    if (cfg.cleanupAfterTest && channelId) {
      const base = (cfg.baseUrl || '').replace(/\\/$/, '');
      const res = await fetch(base + '/api/v1/payment-channels/' + channelId, {
        method: 'DELETE',
        credentials: 'include',
      });
      result.cleanedUp = res.ok;
      result.httpStatus = res.status;
    }
  } catch (e) {
    result.cleanupError = e.message;
  }
  automaSetVariable('finalSummary', JSON.stringify(result, null, 2));
  automaNextBlock();
})();
"""

# ---------------------------------------------------------------------------
# Build the linear chain
# ---------------------------------------------------------------------------
chain = []  # list of node ids in execution order (for happy path)

def push(node_id):
    chain.append(node_id)
    return node_id

row = 0
def next_pos():
    global row
    row += 1
    return {"x": 100 + (row % 8) * X_STEP, "y": Y_BASE + (row // 8) * 220}


def add(node_id, label, data):
    pos = next_pos()
    block(node_id, label, data, x=pos["x"], y=pos["y"])
    return push(node_id)


add("n1", "trigger", base_data("手动触发", type="manual", interval=60, delay=5, date="", time="00:00",
                                url="", shortcut="", activeInInput=False, isUrlRegex=False, days=[],
                                contextMenuName="", contextTypes=[], parameters=[], preferParamsInTab=False,
                                observeElement={"selector": "", "baseSelector": "", "matchPattern": "",
                                                "targetOptions": {"subtree": False, "childList": True,
                                                                    "attributes": False, "attributeFilter": [],
                                                                    "characterData": False},
                                                "baseElOptions": {"subtree": False, "childList": True,
                                                                    "attributes": False, "attributeFilter": [],
                                                                    "characterData": False}}))

add("n2", "new-tab", new_tab_data("{{globalData.baseUrl}}/#/login", "打开管理端登录页", wait_loaded=True))
add("n3", "delay", delay_data(1500, "等待应用初始化"))
add("n4", "javascript-code", js_data(LOGOUT_JS, "强制登出，确保测试从干净状态开始（幂等前置步骤）"))
add("n5", "new-tab", new_tab_data("{{globalData.baseUrl}}/#/login", "重新加载到登录页", update_prev=True, wait_loaded=True))
add("n6", "delay", delay_data(1200, "等待登录表单渲染"))
add("n7", "forms", forms_data("#email", "{{globalData.adminEmail}}", "填写管理员邮箱", wait=True, wait_timeout=8000))
add("n8", "forms", forms_data("#password", "{{globalData.adminPassword}}", "填写管理员密码"))
add("n9", "event-click", click_data('button[type="submit"]', "点击登录按钮"))
add("n10", "delay", delay_data(2500, "等待登录完成并加载管理端主界面"))
add("n11", "javascript-code", js_data(CREATE_CREEM_JS, "通过已登录浏览器会话调用后端 API 创建 Creem 沙箱支付渠道"))
add("n12", "new-tab", new_tab_data("{{globalData.baseUrl}}/#/payment_channels", "跳转到『支付渠道』页面", update_prev=True, wait_loaded=True))
add("n13", "delay", delay_data(1500, "等待支付渠道列表加载"))
n14 = add("n14", "element-exists", element_exists_data(
    '.shadow-card:has(h3:contains("{{globalData.creemAccountName}}"))',
    "校验 Creem 渠道卡片已显示", try_count=6, timeout=1000))
add("n15", "event-click", click_data(
    '.shadow-card:has(h3:contains("{{globalData.creemAccountName}}")) button:contains("测试连通性")',
    "点击该渠道『测试连通性』", wait=True, wait_timeout=8000))
add("n16", "delay", delay_data(1800, "等待连通性测试完成"))
n17 = add("n17", "element-exists", element_exists_data(
    'div:contains("API 握手成功")', "校验连通性测试成功提示", try_count=6, timeout=1000))
add("n18", "new-tab", new_tab_data("{{globalData.baseUrl}}/#/email_channels", "跳转到『邮件渠道』页面", update_prev=True, wait_loaded=True))
add("n19", "delay", delay_data(1200, "等待邮件渠道列表加载"))
add("n20", "event-click", click_data('button:contains("添加发件渠道")', "点击『添加发件渠道』", wait=True, wait_timeout=5000))
add("n21", "delay", delay_data(600, "等待新增渠道侧栏弹出"))
add("n22", "forms", forms_data('input[placeholder="如：SendGrid 主通道"]', "{{globalData.emailChannelName}}",
                                "填写渠道名称", wait=True, wait_timeout=5000))
add("n23", "forms", forms_data('input[placeholder="如：Novas Notifications"]', "{{globalData.resendSenderName}}", "填写发件人昵称"))
add("n24", "forms", forms_data('input[placeholder="billing@yourdomain.com"]', "{{globalData.resendSenderEmail}}", "填写发件人邮箱"))
add("n25", "forms", forms_data('input[placeholder="服务商控制台生成的 API 密钥"]', "{{globalData.resendApiKey}}", "填写 Resend API Key"))
add("n26", "event-click", click_data('button[type="submit"]:contains("确认添加渠道")', "提交新增邮件渠道"))
add("n27", "delay", delay_data(1200, "等待渠道创建完成"))
n28 = add("n28", "element-exists", element_exists_data('div:contains("已成功添加")', "校验邮件渠道创建成功提示", try_count=6, timeout=1000))
add("n29", "event-click", click_data(
    '.shadow-card:has(h3:contains("{{globalData.emailChannelName}}")) button:contains("发测试信")',
    "点击该渠道『发测试信』", wait=True, wait_timeout=5000))
add("n30", "delay", delay_data(500, "等待发送测试邮件侧栏弹出"))
add("n31", "forms", forms_data('#form-test-email input[type="email"]', "{{globalData.testRecipientEmail}}", "填写测试收件邮箱"))
add("n32", "event-click", click_data('#form-test-email button[type="submit"]', "点击『立即发送测试信』"))
add("n33", "delay", delay_data(2200, "等待 Resend 真实发信完成"))
n34 = add("n34", "element-exists", element_exists_data('div:contains("测试邮件投递成功")', "校验测试邮件发送成功提示", try_count=8, timeout=1000))
add("n35", "new-tab", new_tab_data("{{globalData.baseUrl}}/#/payment_channels", "返回『支付渠道』页面准备 Sandbox 下单测试", update_prev=True, wait_loaded=True))
add("n36", "delay", delay_data(1200, "等待页面加载"))
add("n37", "event-click", click_data(
    '.shadow-card:has(h3:contains("{{globalData.creemAccountName}}")) button:contains("测试交易")',
    "点击『测试交易』打开 Sandbox 下单面板", wait=True, wait_timeout=5000))
add("n38", "delay", delay_data(600, "等待面板渲染"))
add("n39", "forms", forms_data('input[placeholder="prod_xxx"]', "{{globalData.creemProductId}}", "填写 Creem 商品 ID", wait=True, wait_timeout=5000))
add("n40", "forms", forms_data('input[placeholder="tester@example.com"]', "{{globalData.creemCustomerEmail}}", "填写测试客户邮箱（可选）"))
add("n41", "event-click", click_data('button:contains("Sandbox 测试下单")', "执行 Sandbox 测试下单"))
add("n42", "delay", delay_data(2500, "等待 Creem Checkout 会话创建"))
n43 = add("n43", "element-exists", element_exists_data('div:contains("Checkout 已创建")', "校验 Checkout 创建成功提示", try_count=8, timeout=1000))
add("n44", "javascript-code", js_data(CLEANUP_JS, "汇总结果并按需清理测试创建的 Creem 渠道"))
add("n45", "notification", notification_data(
    "✅ NovasPay 渠道与邮件配置自动化测试完成",
    "登录、Creem 支付渠道创建与连通性测试、Resend 邮件渠道创建与发信测试、Checkout 沙箱下单均已执行完毕。\\n"
    "创建的 Creem 渠道ID: {{variables.creemChannelId}}\\n"
    "清理结果: {{variables.finalSummary}}\\n"
    "请在 Automa『日志』中查看每一步的详细执行结果。",
    "输出最终测试汇总通知"))

# Failure fan-in node
pos = next_pos()
block("nF1", "notification", notification_data(
    "❌ NovasPay 自动化测试步骤失败",
    "某个关键校验步骤未在预期时间内通过。请打开 Automa 执行日志，定位具体失败的节点，\\n"
    "并检查：1) 登录态是否正常 2) 渠道/邮箱凭据是否正确 3) 网络是否可以访问 Creem / Resend "
    "4) 页面文案是否因为切换了界面语言而与内置选择器不一致（默认按简体中文 zh-CN 文案编写）。",
    "汇报失败原因"), x=pos["x"], y=Y_BASE + 260)

# Linear edges (happy path) — walk the recorded chain in order.
for a, b in zip(chain, chain[1:]):
    add_edge(a, b)

# Branch edges: element-exists "not found" (output-2) -> failure notification
for eid in (n14, n17, n28, n34, n43):
    add_edge(eid, "nF1", source_output=2)

GLOBAL_DATA = {
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
    "cleanupAfterTest": True,
}

now_ms = int(time.time() * 1000)

workflow = {
    "id": "novaspay-e2e-channel-email",
    "name": "NovasPay - 渠道与邮件配置自动化测试",
    "icon": "riFlashlightLine",
    "folderId": None,
    "drawflow": {
        "edges": EDGES,
        "zoom": 0.8,
        "nodes": NODES,
    },
    "table": [],
    "dataColumns": [],
    "description": (
        "登录 NovasPay 管理端，创建/测试 Creem 沙箱支付渠道（连通性测试 + Sandbox 测试下单）"
        "与 Resend 邮件渠道（创建 + 发送测试邮件），并对每一步的界面反馈做断言。"
        "运行前请先在『Global data』里填好你自己的渠道与邮箱账号信息。"
    ),
    "trigger": NODE_INDEX["n1"]["data"],
    "createdAt": now_ms,
    "updatedAt": now_ms,
    "isDisabled": False,
    "settings": {
        "publicId": "",
        "blockDelay": 0,
        "saveLog": True,
        "debugMode": False,
        "restartTimes": 1,
        "notification": True,
        "execContext": "popup",
        "reuseLastState": False,
        "inputAutocomplete": True,
        "onError": "stop-workflow",
        "executedBlockOnWeb": True,
        "insertDefaultColumn": False,
        "defaultColumnName": "column",
    },
    "version": "1.29.0",
    "globalData": json.dumps(GLOBAL_DATA, ensure_ascii=False, indent=2),
    "connectedTable": None,
}

with open("/tmp/novaspay-automa-workflow.json", "w", encoding="utf-8") as f:
    json.dump(workflow, f, ensure_ascii=False, indent=2)

print("nodes:", len(NODES))
print("edges:", len(EDGES))
print("chain length:", len(chain))
