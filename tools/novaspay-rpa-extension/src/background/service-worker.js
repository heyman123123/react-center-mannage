// src/background/service-worker.js
// Test runner: opens a fresh tab per run, executes setup → steps → assertions → teardown,
// returns a structured report.

import { MSG } from "../lib/messages.js";

const ACTIVE_TAB = { tabId: null };

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.id) ACTIVE_TAB.tabId = tab.id;
  await chrome.sidePanel?.open?.({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return false;
  switch (msg.type) {
    case MSG.OPEN_SIDE_PANEL: {
      const tabId = sender.tab?.id ?? ACTIVE_TAB.tabId;
      if (tabId) chrome.sidePanel?.open?.({ tabId });
      sendResponse({ ok: true });
      return false;
    }
    case MSG.SET_ACTIVE_TAB: {
      ACTIVE_TAB.tabId = msg.payload?.tabId ?? ACTIVE_TAB.tabId;
      sendResponse({ ok: true, tabId: ACTIVE_TAB.tabId });
      return false;
    }
    case MSG.GET_NGROK_URL: {
      fetch("http://127.0.0.1:4040/api/tunnels")
        .then((r) => r.json())
        .then((data) => {
          const t = (data.tunnels || []).find((t) =>
            String(t.public_url || "").startsWith("https")
          );
          sendResponse({ ok: true, url: t?.public_url || null });
        })
        .catch((err) =>
          sendResponse({ ok: false, error: err.message || String(err) })
        );
      return true;
    }
    case MSG.RUN_SUITE: {
      runSuite(msg.payload).catch((err) =>
        broadcastLog("error", `suite error: ${err.message || String(err)}`)
      );
      sendResponse({ ok: true });
      return false;
    }
    case MSG.RUN_TEST: {
      runSingle(msg.payload).catch((err) =>
        broadcastLog("error", `test error: ${err.message || String(err)}`)
      );
      sendResponse({ ok: true });
      return false;
    }
    default:
      return false;
  }
});

function broadcastLog(level, message, extra) {
  chrome.runtime.sendMessage({
    type: MSG.RUN_LOG,
    payload: { level, message, extra, at: Date.now() },
  }).catch(() => {});
}

function broadcastReport(report) {
  chrome.runtime.sendMessage({ type: MSG.RUN_REPORT, payload: report }).catch(() => {});
}

function applyVars(value, vars) {
  if (typeof value !== "string") return value;
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
    vars && vars[k] !== undefined ? String(vars[k]) : ""
  );
}

async function runSingle({ test, vars }) {
  return runTests([test], vars);
}

async function runSuite({ tests, vars }) {
  return runTests(tests, vars);
}

async function runTests(tests, vars) {
  if (!tests?.length) throw new Error("no tests provided");
  const ctxVars = { ...(vars || {}) };
  const firstUrl = pickFirstNavigateUrl(tests[0], ctxVars) || ctxVars.baseUrl || "http://127.0.0.1:3000";
  broadcastLog("info", `opening ${firstUrl}`);
  const tab = await chrome.tabs.create({ url: firstUrl, active: true });
  ACTIVE_TAB.tabId = tab.id;
  await waitForTabLoad(tab.id);
  await ensureRunner(tab.id);

  const report = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    vars: ctxVars,
    tests: [],
    summary: { total: tests.length, passed: 0, failed: 0, skipped: 0 },
  };

  for (const test of tests) {
    const t = await runOneTest(tab.id, test, ctxVars);
    report.tests.push(t);
    if (t.status === "passed") report.summary.passed++;
    else if (t.status === "failed") report.summary.failed++;
    else report.summary.skipped++;
  }

  report.finishedAt = new Date().toISOString();
  broadcastReport(report);
  return report;
}

async function runOneTest(tabId, test, vars) {
  const startedAt = Date.now();
  const result = {
    id: test.id,
    name: test.name,
    module: test.module,
    status: "passed",
    durationMs: 0,
    stepLogs: [],
    assertionResults: [],
    error: null,
  };
  try {
    broadcastLog("info", `▶ [${test.module}] ${test.name}`);

    // Run setup → steps → assertions → teardown in the same tab.
    await runGroup(tabId, test.setup || [], vars, result, "setup");
    await runGroup(tabId, test.steps || [], vars, result, "steps");
    // Assertions are evaluated in the page context.
    const assertReply = await callPage(tabId, MSG.RUN_ASSERTIONS, {
      assertions: test.assertions || [],
      vars,
    }, 4000);
    result.assertionResults = assertReply?.results || [];
    if (!assertReply?.ok || result.assertionResults.some((r) => !r.ok)) {
      const detail = assertReply?.error || describeFailures(result.assertionResults);
      throw new Error(`assertion failed: ${detail}`);
    }
    await runGroup(tabId, test.teardown || [], vars, result, "teardown");
  } catch (err) {
    result.status = "failed";
    result.error = err.message || String(err);
    broadcastLog("error", `✗ [${test.module}] ${test.name}: ${result.error}`);
  } finally {
    result.durationMs = Date.now() - startedAt;
    if (result.status === "passed") {
      broadcastLog("success", `✓ [${test.module}] ${test.name} (${result.durationMs}ms)`);
    }
  }
  return result;
}

async function runGroup(tabId, steps, vars, result, groupLabel) {
  for (const step of steps) {
    const label = stepLabel(step);
    try {
      broadcastLog("info", `  · ${label}`);
      if (step.type === "manual") {
        const answer = await waitForHuman(step);
        const ok = !!answer?.ok;
        result.stepLogs.push({ group: groupLabel, type: step.type, ok, error: ok ? null : answer?.note });
        if (!ok) throw new Error(answer?.note || "人工步骤未通过");
        continue;
      }
      const timeoutMs = Number(step.timeoutMs) || 3000;
      const reply = await callPage(
        tabId,
        MSG.RUN_STEP,
        { step, ctx: { vars } },
        timeoutMs + 800
      );
      result.stepLogs.push({ group: groupLabel, type: step.type, ok: !!reply?.ok, error: reply?.error });
      if (!reply?.ok) throw new Error(reply?.error || `${label} failed`);

      if (reply.result?.navigate) {
        await navigateTab(tabId, reply.result.navigate, reply.result.reload);
      }
    } catch (err) {
      const message = err.message || String(err);
      result.stepLogs.push({ group: groupLabel, type: step.type, ok: false, error: message });
      throw new Error(`${label}: ${message}`);
    }
  }
}

function stepLabel(step) {
  if (step.type === "manual") return `人工 ${step.title || ""}`.trim();
  const target = step.tab || step.selector || step.ready || step.url || "";
  return target ? `${step.type} ${target}` : step.type;
}

let qaPort = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "qa-runner") return;
  qaPort = port;
  port.onDisconnect.addListener(() => {
    if (qaPort === port) qaPort = null;
  });
});

function waitForHuman(step) {
  return new Promise((resolve, reject) => {
    const port = qaPort;
    if (!port) {
      reject(new Error("侧边栏未连接，无法等待人工操作"));
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const finish = (fn, value) => {
      port.onMessage.removeListener(onMsg);
      port.onDisconnect.removeListener(onDisconnect);
      chrome.action.setBadgeText({ text: "" }).catch(() => {});
      fn(value);
    };
    const onMsg = (msg) => {
      if (!msg || msg.type !== "human-done" || msg.id !== id) return;
      finish(resolve, msg);
    };
    const onDisconnect = () => finish(reject, new Error("侧边栏已关闭，人工步骤中断"));
    port.onMessage.addListener(onMsg);
    port.onDisconnect.addListener(onDisconnect);
    chrome.action.setBadgeText({ text: "停" }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ color: "#b45309" }).catch(() => {});
    port.postMessage({
      type: "wait-human",
      id,
      title: step.title || "需要人工操作",
      hint: step.hint || "",
    });
  });
}

function callPage(tabId, type, payload, timeoutMs) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.runtime.onMessage.removeListener(onMsg);
      fn(value);
    };
    const timer = setTimeout(() => {
      finish(reject, new Error("page did not respond in time"));
    }, timeoutMs);
    const onMsg = (msg) => {
      if (msg?.type !== MSG.PAGE_RESULT || msg.payload?.id !== id) return;
      finish(resolve, msg.payload);
    };
    chrome.runtime.onMessage.addListener(onMsg);
    chrome.tabs.sendMessage(tabId, { type, payload: { id, ...payload } }).catch((err) => {
      finish(reject, err);
    });
  });
}

function describeFailures(results) {
  return (results || [])
    .filter((r) => !r.ok)
    .map((r) => `[${r.type}] ${r.label} expected=${JSON.stringify(r.expected)} actual=${JSON.stringify(r.actual)} err=${r.error || ""}`)
    .join("; ") || "assertion failed";
}

function pickFirstNavigateUrl(test, vars) {
  for (const arr of [test.setup || [], test.steps || []]) {
    for (const s of arr) {
      if (s?.type === "navigate" && s.url) return applyVars(s.url, vars);
    }
  }
  return null;
}

async function navigateTab(tabId, url, reload) {
  if (reload) {
    const fresh = url.includes("?") ? `${url}&__rpa=${Date.now()}` : `${url}?__rpa=${Date.now()}`;
    const loaded = waitForNavigation(tabId);
    await chrome.tabs.update(tabId, { url: fresh, active: true });
    await loaded;
  } else {
    const tab = await chrome.tabs.get(tabId);
    const sameDocument = isSameDocument(tab.url, url);
    const loaded = sameDocument ? null : waitForNavigation(tabId);
    await chrome.tabs.update(tabId, { url, active: true });
    if (loaded) await loaded;
    else await sleep(300);
  }
  await ensureRunner(tabId);
}

function isSameDocument(current, next) {
  try {
    const a = new URL(current);
    const b = new URL(next);
    return a.origin === b.origin && a.pathname === b.pathname && a.search === b.search;
  } catch {
    return false;
  }
}

async function ensureRunner(tabId) {
  if (await runnerInstalled(tabId) && (await ping(tabId, 2))) return;
  if (await ping(tabId, 4)) return;
  broadcastLog("info", "injecting page runner");
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content/runner.js"],
  });
  if (!(await ping(tabId, 6))) {
    throw new Error("page runner not ready (content script failed to load)");
  }
}

async function runnerInstalled(tabId) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => globalThis.__novaspayRpa === true,
    });
    return !!res?.result;
  } catch {
    return false;
  }
}

async function ping(tabId, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    try {
      const reply = await chrome.tabs.sendMessage(tabId, { type: "novaspay/ping" });
      if (reply?.ok) return true;
    } catch {
      // retry
    }
    await sleep(250);
  }
  return false;
}

function waitForNavigation(tabId) {
  return new Promise((resolve) => {
    let loading = false;
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(handler);
      resolve();
    };
    const handler = (updatedId, info) => {
      if (updatedId !== tabId) return;
      if (info.status === "loading") loading = true;
      if (info.status === "complete" && loading) done();
    };
    const timer = setTimeout(done, 15000);
    chrome.tabs.onUpdated.addListener(handler);
  });
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(handler);
      resolve();
    };
    const handler = (updatedId, info) => {
      if (updatedId === tabId && info.status === "complete") done();
    };
    const timer = setTimeout(done, 15000);
    chrome.tabs.onUpdated.addListener(handler);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete" && tab.url && !tab.url.startsWith("about:")) done();
    }).catch(() => {});
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}