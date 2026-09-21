// src/lib/flow.js
// Automation test DSL. Pure-DOM, no admin API calls.
//
// Each test has the shape:
//   {
//     id, name, description, module,
//     setup?: Step[],          // run before every test
//     teardown?: Step[],       // run after every test
//     steps: Step[],           // main flow
//     assertions?: Assertion[] // checked at the end; failure marks test as failed
//   }
//
// Step types: navigate, click, type, select, press, waitFor, sleep,
//             screenshot, extract, login, logout
//
// Assertion types:
//   - text      { selector, equals | contains | matches, value }
//   - exists    { selector, mustExist: boolean }
//   - attr      { selector, name, equals | contains, value }
//   - url       { equals | contains | matches, value }
//   - count     { selector, equals | gte | lte, value }

export const STEP_TYPES = [
  "navigate", "goto", "click", "type", "select", "press",
  "waitFor", "waitForAny", "sleep", "screenshot", "extract",
  "login", "logout", "ensureSession", "manual",
];

export const ASSERTION_TYPES = ["text", "exists", "attr", "url", "count"];

// ---- Sample tests, organized by module ----

const RENDER_MS = 3000;

const PAGES = [
  ["dashboard", "#kpi-card-total-revenue"],
  ["transactions", "#export-csv-btn"],
  ["reconciliation"],
  ["settlements"],
  ["financial_reports"],
  ["refunds"],
  ["users"],
  ["merchant_review"],
  ["tenants"],
  ["products", "[data-rpa=products-search]"],
  ["discounts"],
  ["promo_campaigns"],
  ["payment_channels", "[data-rpa=channel-card]"],
  ["payment_webhooks"],
  ["apps"],
  ["exchange_rates"],
  ["fee_rules"],
  ["risk_rules"],
  ["email_templates"],
  ["email_channels", "[data-rpa=email-channel-card]"],
  ["email_webhooks"],
  ["departments"],
  ["roles"],
  ["permission_packs"],
  ["menus"],
  ["system_users"],
  ["dictionary"],
  ["audit_logs"],
  ["system_config"],
  ["scheduled_tasks"],
  ["alerts"],
];

function openPage(tab, ready) {
  return {
    type: "goto",
    tab,
    ready: ready || `[data-rpa=view][data-rpa-tab=${tab}]`,
    timeoutMs: RENDER_MS,
  };
}

function manual(title, hint) {
  return { type: "manual", title, hint };
}

export const SAMPLE_TESTS = [
  {
    id: "qa-auth",
    module: "1 鉴权",
    name: "登录、错误密码、再次登录",
    description: "先退出。错误密码必须停在登录页。再用管理员登录。最后请你刷新页面，确认不会闪回登录页。",
    steps: [
      { type: "waitForAny", selectors: ["[data-rpa=user-menu]", 'input[name="email"]'], timeoutMs: RENDER_MS },
      { type: "logout", timeoutMs: RENDER_MS },
      { type: "navigate", url: "{{baseUrl}}/", reload: true },
      { type: "waitFor", selector: 'input[name="email"]', timeoutMs: RENDER_MS },
      { type: "type", selector: 'input[name="email"]', value: "{{email}}" },
      { type: "type", selector: 'input[name="password"]', value: "wrong-password" },
      { type: "click", selector: 'form button[type="submit"]', ready: '[role="alert"]', timeoutMs: RENDER_MS },
      { type: "type", selector: 'input[name="email"]', value: "{{email}}" },
      { type: "type", selector: 'input[name="password"]', value: "{{password}}" },
      { type: "click", selector: 'form button[type="submit"]', ready: "{{loggedInMarker}}", timeoutMs: RENDER_MS },
      manual(
        "确认刷新后仍保持登录",
        "在业务页按刷新。确认没有闪回登录页，侧边栏还在。确认后点「已完成，继续」。如果闪回了，写上现象再点「不通过」。"
      ),
    ],
    assertions: [
      { type: "exists", selector: "[data-rpa=user-menu]", mustExist: true },
    ],
  },
  {
    id: "qa-nav",
    module: "2 导航",
    name: "每个菜单都能打开",
    description: "已登录则逐个进入全部业务页，等到骨架屏消失。",
    steps: [
      { type: "ensureSession", timeoutMs: RENDER_MS },
      ...PAGES.map(([tab, ready]) => openPage(tab, ready)),
    ],
    assertions: [
      { type: "exists", selector: "[data-rpa=view]", mustExist: true },
    ],
  },
  {
    id: "qa-payment",
    module: "3 支付",
    name: "渠道密钥、探活、测试下单",
    description: "自动打开编辑页核对原始密钥，点探活，再打开测试下单。支付和 Webhook 需要你在页面上做完。",
    steps: [
      { type: "ensureSession", timeoutMs: RENDER_MS },
      openPage("payment_channels", "[data-rpa=channel-card]"),
      {
        type: "click",
        selector: "[data-rpa=channel-card] [data-rpa=edit]",
        ready: "[data-rpa=secret-key]",
        filled: true,
        timeoutMs: RENDER_MS,
      },
      { type: "click", selector: "[data-rpa=sheet-cancel]", gone: "[data-rpa=edit-sheet]", timeoutMs: RENDER_MS },
      { type: "click", selector: "[data-rpa=channel-card] [data-rpa=test-connection]", timeoutMs: RENDER_MS },
      {
        type: "click",
        selector: "[data-rpa=channel-card] [data-rpa=open-test-tx]",
        ready: "[data-rpa=send-test-webhook]",
        timeoutMs: RENDER_MS,
      },
      manual(
        "完成 Sandbox 支付并确认回调",
        "1. 看编辑页里的 Webhook 路径，确认 Creem 后台已经配上当前 ngrok 地址。2. 在已打开的测试下单里选择商品，完成一笔 Sandbox 支付。3. 确认回调到达后点「已完成，继续」。Live 环境不要在这里随便下单；如果不能测，写明原因再点「不通过」。"
      ),
    ],
    assertions: [
      { type: "exists", selector: "[data-rpa=view][data-rpa-tab=payment_channels]", mustExist: true },
    ],
  },
  {
    id: "qa-catalog",
    module: "4 商品",
    name: "商品搜索，并确认可下单商品",
    description: "自动在商品页输入再清空搜索。商品同步需要你确认。",
    steps: [
      { type: "ensureSession", timeoutMs: RENDER_MS },
      openPage("products", "[data-rpa=products-search]"),
      { type: "type", selector: "[data-rpa=products-search]", value: "qa", timeoutMs: RENDER_MS },
      { type: "type", selector: "[data-rpa=products-search]", value: "", timeoutMs: RENDER_MS },
      openPage("discounts"),
      manual(
        "确认商品和折扣可用",
        "确认列表里有一笔能用于 Creem 测试的商品。如果没有，请在这个页面完成同步或新建，再确认折扣绑定是否符合预期。做完点「已完成，继续」。上下架目前刷新会丢，不要把它当成已保存。"
      ),
    ],
    assertions: [
      { type: "exists", selector: "[data-rpa=view][data-rpa-tab=discounts]", mustExist: true },
    ],
  },
  {
    id: "qa-ledger",
    module: "5 账务",
    name: "交易入账、退款、对账、结算",
    description: "自动打开交易、退款、对账、结算、报表。入账和退款需要你对照刚才那笔支付来核。",
    steps: [
      { type: "ensureSession", timeoutMs: RENDER_MS },
      openPage("transactions", "#export-csv-btn"),
      manual(
        "核对交易是否入账",
        "在交易列表找到刚才的 Sandbox 支付。确认只入账一次，重复 webhook 没有生成第二笔。找不到就先补发回调，再回来点「已完成，继续」。"
      ),
      openPage("refunds"),
      manual(
        "做一笔合法退款，并试一次超额",
        "对这笔成功交易：先提交超额或负数，预期应被拒绝。再提交一笔不超过原单的退款。做完点「已完成，继续」。如果按钮没有真正调渠道，写明现象再点「不通过」。"
      ),
      openPage("reconciliation"),
      openPage("settlements"),
      openPage("financial_reports"),
      manual(
        "看对账、出金和报表",
        "对账目前不是真实三方账单匹配，出金多半不会真正打款。请确认页面能打开、筛选可用，不要把「一键对账」或「出金成功」当成上线通过。看完点「已完成，继续」。"
      ),
    ],
    assertions: [
      { type: "exists", selector: "[data-rpa=view]", mustExist: true },
    ],
  },
  {
    id: "qa-mail",
    module: "6 邮件",
    name: "打开发信测试，并确认收件箱",
    description: "自动打开邮件渠道的测试发信侧栏。是否真正送达需要你看邮箱。",
    steps: [
      { type: "ensureSession", timeoutMs: RENDER_MS },
      openPage("email_channels", "[data-rpa=email-channel-card]"),
      {
        type: "click",
        selector: "[data-rpa=email-channel-card] [data-rpa=open-test-email]",
        ready: "[data-rpa=email-test-sheet]",
        timeoutMs: RENDER_MS,
      },
      openPage("email_templates"),
      openPage("email_webhooks"),
      manual(
        "发送测试信并查看收件箱",
        "在测试发信侧栏填写你自己的邮箱并发送。到收件箱确认是否收到。接口返回成功不等于已投递。模板保存目前刷新会丢，只看预览即可。确认后点「已完成，继续」。"
      ),
    ],
    assertions: [
      { type: "exists", selector: "[data-rpa=view]", mustExist: true },
    ],
  },
  {
    id: "qa-iam",
    module: "7 权限",
    name: "打开权限页面，并核对最小权限",
    description: "自动打开角色、权限包、系统用户、部门、菜单、字典、审计。最小权限登录需要你换账号看一眼。",
    steps: [
      { type: "ensureSession", timeoutMs: RENDER_MS },
      openPage("roles"),
      openPage("permission_packs"),
      openPage("system_users"),
      openPage("departments"),
      openPage("menus"),
      openPage("dictionary"),
      openPage("audit_logs"),
      manual(
        "用非超管账号核对菜单",
        "如果这轮要验权限：退出后用一个只有部分菜单的账号登录，确认看不到的页面即使改地址也进不去。验完再登录回管理员。不做这轮就直接点「已完成，继续」。发现越权则点「不通过」并写上账号和页面。"
      ),
    ],
    assertions: [
      { type: "exists", selector: "[data-rpa=user-menu]", mustExist: true },
    ],
  },
  {
    id: "qa-logout",
    module: "8 收尾",
    name: "退出后不能再进业务页",
    description: "退出后应回到登录页。此时再打开看板地址，也必须还在登录页。",
    steps: [
      { type: "waitForAny", selectors: ["[data-rpa=user-menu]", 'input[name="email"]'], timeoutMs: RENDER_MS },
      { type: "logout", timeoutMs: RENDER_MS },
      { type: "waitFor", selector: 'input[name="email"]', timeoutMs: RENDER_MS },
      openPage("dashboard", 'input[name="email"]'),
    ],
    assertions: [
      { type: "exists", selector: 'input[name="email"]', mustExist: true },
      { type: "exists", selector: "[data-rpa=user-menu]", mustExist: false },
    ],
  },
];


// ---- Variable substitution ----

export function applyVariables(value, vars) {
  if (typeof value !== "string") return value;
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
    vars && vars[k] !== undefined ? String(vars[k]) : ""
  );
}

// ---- Step execution ----

// Each stage waits until the target is visible and skeletons are gone.
const RENDER_TIMEOUT_MS = 3000;

export async function executeStep(step, ctx) {
  const vars = ctx.vars || {};
  const timeout = Number(step.timeoutMs) || RENDER_TIMEOUT_MS;
  const deadline = Date.now() + timeout;
  const left = () => Math.max(0, deadline - Date.now());
  let result;
  switch (step.type) {
    case "navigate":
      result = { ok: true, navigate: applyVariables(step.url, vars), reload: !!step.reload };
      break;
    case "goto": {
      const tab = applyVariables(step.tab, vars);
      const hash = `#/${tab}`;
      if (window.location.hash !== hash) window.location.hash = hash;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      result = { ok: true, hash };
      break;
    }
    case "click":
      result = await clickEl(applyVariables(step.selector, vars), left());
      break;
    case "type":
      result = await typeInto(
        applyVariables(step.selector, vars),
        applyVariables(step.value, vars),
        step.delay,
        left()
      );
      break;
    case "select":
      result = await selectOption(applyVariables(step.selector, vars), applyVariables(step.value, vars), left());
      break;
    case "press":
      result = await pressKey(applyVariables(step.selector, vars), step.key, left());
      break;
    case "waitFor":
      await waitRendered(applyVariables(step.selector, vars), left(), { filled: step.filled });
      result = { ok: true, found: step.selector };
      break;
    case "waitForAny": {
      const selectors = (step.selectors || []).map((s) => applyVariables(s, vars));
      const found = await waitForAny(selectors, left());
      result = { ok: true, found };
      break;
    }
    case "sleep":
      await sleep(Number(step.ms) || 0);
      result = { ok: true, slept: step.ms };
      break;
    case "screenshot":
      result = { ok: true, screenshot: step.filename || `rpa-${Date.now()}.png` };
      break;
    case "extract":
      result = await extractAttr(applyVariables(step.selector, vars), step.attribute, step.intoKey, ctx, left());
      break;
    case "login":
      result = await fillLoginForm({
        email: applyVariables(step.email, vars),
        password: applyVariables(step.password, vars),
        loggedInSelector: applyVariables(
          step.loggedInSelector || vars.loggedInMarker || "[data-rpa=user-menu]",
          vars
        ),
        left,
      });
      break;
    case "logout":
      result = await logoutFlow(left);
      break;
    case "ensureSession":
      result = await ensureSession(vars, left);
      break;
    default:
      return { ok: false, error: `unknown step type: ${step.type}` };
  }
  if (step.ready) {
    await waitRendered(applyVariables(step.ready, vars), left(), { filled: step.filled });
  }
  if (step.gone) {
    await waitGone(applyVariables(step.gone, vars), left());
  }
  return result;
}

async function clickEl(selector, timeoutMs) {
  const el = await waitRendered(selector, timeoutMs);
  el.scrollIntoView({ block: "center" });
  const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
  el.dispatchEvent(new PointerEvent("pointerdown", opts));
  el.dispatchEvent(new MouseEvent("mousedown", opts));
  el.dispatchEvent(new PointerEvent("pointerup", opts));
  el.dispatchEvent(new MouseEvent("mouseup", opts));
  el.click();
  return { ok: true, clicked: selector };
}

async function typeInto(selector, value, delayMs, timeoutMs) {
  const el = await waitRendered(selector, timeoutMs);
  el.focus();
  const proto =
    el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype :
    el.tagName === "SELECT"   ? window.HTMLSelectElement.prototype :
                                window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  fireEvent(el, "input");
  fireEvent(el, "change");
  if (delayMs) await sleep(delayMs);
  return { ok: true, typed: selector, value };
}

async function selectOption(selector, value, timeoutMs) {
  const el = await waitRendered(selector, timeoutMs);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
  setter?.call(el, value);
  fireEvent(el, "input");
  fireEvent(el, "change");
  return { ok: true, selected: value };
}

async function pressKey(selector, key, timeoutMs) {
  const el = await waitRendered(selector, timeoutMs);
  el.focus();
  fireEvent(el, "keydown", { key });
  fireEvent(el, "keyup", { key });
  return { ok: true, pressed: key };
}

async function extractAttr(selector, attr, intoKey, ctx, timeoutMs) {
  const el = await waitRendered(selector, timeoutMs);
  const value = attr ? el.getAttribute(attr) : (el.textContent || "").trim();
  if (intoKey) ctx.vars = { ...ctx.vars, [intoKey]: value };
  return { ok: true, key: intoKey, value };
}

async function ensureSession(vars, left) {
  const marker = vars.loggedInMarker || "[data-rpa=user-menu]";
  const found = await waitForAny([marker, 'input[name="email"]'], left);
  if (found === marker) return { ok: true, skipped: "already logged in" };
  return fillLoginForm({
    email: vars.email,
    password: vars.password,
    loggedInSelector: marker,
    left,
  });
}
async function fillLoginForm({ email, password, loggedInSelector, left }) {
  const marker = loggedInSelector || "[data-rpa=user-menu]";
  if (isVisible(document.querySelector(marker))) {
    return { ok: true, skipped: "already logged in" };
  }
  await typeInto('input[name="email"]', email, 0, left());
  await typeInto('input[name="password"]', password, 0, left());
  const pwEl = document.querySelector('input[name="password"]');
  const submit = pwEl?.closest("form")?.querySelector('button[type="submit"]')
              || document.querySelector('form button[type="submit"]');
  if (!submit) throw new Error("login submit button not found");
  submit.click();
  await waitRendered(marker, left());
  return { ok: true };
}

async function logoutFlow(left) {
  const menu = document.querySelector("[data-rpa=user-menu]");
  if (!isVisible(menu)) return { ok: true, skipped: "not logged in" };
  await clickEl("[data-rpa=user-menu]", left());
  await clickEl("[data-rpa=logout]", left());
  await waitRendered('input[name="email"]', left());
  return { ok: true };
}

function isVisible(el) {
  if (!el || !el.isConnected) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function pageSettled(el, { filled } = {}) {
  if (!isVisible(el)) return false;
  if (document.querySelector("[data-rpa=skeleton], [data-rpa=auth-loading]")) return false;
  if (filled) {
    const value = String(el.value ?? "").trim();
    if (!value || value.includes("****")) return false;
  }
  return true;
}

function remaining(timeoutMs) {
  return typeof timeoutMs === "function" ? timeoutMs() : timeoutMs;
}

async function waitRendered(selector, timeoutMs, opts = {}) {
  const start = Date.now();
  const budget = remaining(timeoutMs);
  let hits = 0;
  while (Date.now() - start <= budget) {
    const el = document.querySelector(selector);
    if (pageSettled(el, opts)) {
      hits += 1;
      if (hits >= 2) return el;
    } else {
      hits = 0;
    }
    await sleep(100);
  }
  throw new Error(`timeout waiting for ${selector}`);
}

async function waitForAny(selectors, timeoutMs) {
  const start = Date.now();
  const budget = remaining(timeoutMs);
  while (Date.now() - start <= budget) {
    if (!document.querySelector("[data-rpa=auth-loading]")) {
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (isVisible(el)) return selector;
      }
    }
    await sleep(100);
  }
  throw new Error(`timeout waiting for any of ${selectors.join(" | ")}`);
}

async function waitGone(selector, timeoutMs) {
  const start = Date.now();
  const budget = remaining(timeoutMs);
  while (Date.now() - start <= budget) {
    if (!isVisible(document.querySelector(selector))) return;
    await sleep(100);
  }
  throw new Error(`timeout waiting for ${selector} to close`);
}

function fireEvent(el, type, init = {}) {
  const event =
    type === "keydown" || type === "keyup"
      ? new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init })
      : new Event(type, { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Assertion execution ----

export async function runAssertions(assertions, vars) {
  const results = [];
  for (const a of assertions || []) {
    const r = await runAssertion(a, vars);
    results.push(r);
    if (!r.ok) break; // first failure stops
  }
  return results;
}

async function runAssertion(a, vars) {
  const label = a.label || `${a.type} ${a.selector || a.value || ""}`.trim();
  try {
    switch (a.type) {
      case "exists": {
        const el = document.querySelector(applyVariables(a.selector, vars));
        const ok = !!el === !!a.mustExist;
        return { ok, type: a.type, label, expected: !!a.mustExist, actual: !!el };
      }
      case "text": {
        const el = await waitRendered(applyVariables(a.selector, vars), 3000);
        const text = (el.textContent || "").trim();
        const value = applyVariables(a.value, vars);
        return compareText(text, a, value, label);
      }
      case "attr": {
        const el = await waitRendered(applyVariables(a.selector, vars), 3000);
        const got = el.getAttribute(a.name) || "";
        return compareText(got, a, applyVariables(a.value, vars), label);
      }
      case "url": {
        const got = window.location.href;
        return compareText(got, a, applyVariables(a.value, vars), label);
      }
      case "count": {
        const n = document.querySelectorAll(applyVariables(a.selector, vars)).length;
        const value = Number(a.value);
        let ok = true;
        if (a.equals !== undefined) ok = n === a.equals;
        if (a.gte !== undefined)    ok = ok && n >= a.gte;
        if (a.lte !== undefined)    ok = ok && n <= a.lte;
        return { ok, type: a.type, label, expected: a, actual: n };
      }
      default:
        return { ok: false, type: a.type, label, error: "unknown assertion type" };
    }
  } catch (err) {
    return { ok: false, type: a.type, label, error: err.message || String(err) };
  }
}

function compareText(got, a, want, label) {
  if (a.equals !== undefined) {
    const expected = typeof a.equals === "string" ? a.equals : want;
    return { ok: got === expected, type: a.type, label, expected, actual: got };
  }
  if (a.contains !== undefined) {
    const expected = typeof a.contains === "string" ? a.contains : want;
    return { ok: !!expected && got.includes(expected), type: a.type, label, expected: `contains ${expected}`, actual: got };
  }
  if (a.matches !== undefined) {
    const expected = typeof a.matches === "string" ? a.matches : want;
    const re = new RegExp(expected);
    return { ok: re.test(got), type: a.type, label, expected: `matches ${expected}`, actual: got };
  }
  return { ok: false, type: a.type, label, error: "no comparator (equals/contains/matches)" };
}