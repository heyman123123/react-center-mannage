// src/sidepanel/panel.js
// Side panel: pick tests, run them in batch, render a report.

import { MSG } from "../lib/messages.js";
import { SAMPLE_TESTS } from "../lib/flow.js";

const $ = (id) => document.getElementById(id);

let qaPort = null;

function connectRunner() {
  qaPort = chrome.runtime.connect({ name: "qa-runner" });
  qaPort.onMessage.addListener((msg) => {
    if (msg?.type === "wait-human") showHumanGate(msg);
  });
  qaPort.onDisconnect.addListener(() => {
    qaPort = null;
    setTimeout(connectRunner, 300);
  });
}

function showHumanGate(msg) {
  const box = $("humanGate");
  box.hidden = false;
  $("humanTitle").textContent = msg.title || "需要人工操作";
  $("humanHint").textContent = msg.hint || "";
  $("humanNote").value = "";
  appendLog("warn", `等待人工：${msg.title || ""}`);
  const reply = (ok) => {
    const note = $("humanNote").value.trim();
    qaPort?.postMessage({ type: "human-done", id: msg.id, ok, note: note || (ok ? "" : "人工判定不通过") });
    box.hidden = true;
  };
  $("humanDone").onclick = () => reply(true);
  $("humanFail").onclick = () => reply(false);
  box.scrollIntoView({ block: "start" });
}

connectRunner();

const state = {
  baseUrl: "http://127.0.0.1:3000",
  email: "admin@novaspay.global",
  password: "Admin@123456",
  loggedInMarker: '[data-rpa=user-menu]',
  selectedIds: new Set(SAMPLE_TESTS.map((t) => t.id)),
  lastReport: null,
};

function load() {
  chrome.storage?.local.get(["rpaState"], (data) => {
    if (data?.rpaState) {
      Object.assign(state, data.rpaState);
      const known = new Set(SAMPLE_TESTS.map((t) => t.id));
      const saved = (data.rpaState.selectedIds || []).filter((id) => known.has(id));
      state.selectedIds = new Set(saved.length ? saved : SAMPLE_TESTS.map((t) => t.id));
    }
    render();
  });
}
function persist() {
  chrome.storage?.local.set({
    rpaState: { ...state, password: state.password ? "<redacted>" : "", selectedIds: [...state.selectedIds] },
  });
}

function render() {
  $("baseUrl").value = state.baseUrl;
  $("email").value = state.email;
  $("password").value = state.password || "";
  $("loggedInMarker").value = state.loggedInMarker;
  renderTestList();
}

function renderTestList() {
  const ul = $("testList");
  ul.innerHTML = "";
  // Group by module.
  const groups = SAMPLE_TESTS.reduce((acc, t) => {
    (acc[t.module] ||= []).push(t);
    return acc;
  }, {});
  for (const [module, tests] of Object.entries(groups)) {
    const head = document.createElement("li");
    head.className = "module";
    head.textContent = module;
    ul.appendChild(head);
    for (const t of tests) {
      const li = document.createElement("li");
      li.className = "test";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = state.selectedIds.has(t.id);
      cb.addEventListener("change", () => {
        if (cb.checked) state.selectedIds.add(t.id);
        else state.selectedIds.delete(t.id);
        persist();
      });
      const label = document.createElement("label");
      label.appendChild(cb);
      label.appendChild(document.createTextNode(`${t.name}`));
      li.appendChild(label);
      if (t.description) {
        const d = document.createElement("span");
        d.className = "desc";
        d.textContent = t.description;
        li.appendChild(d);
      }
      const runBtn = document.createElement("button");
      runBtn.textContent = "Run";
      runBtn.className = "ghost run";
      runBtn.addEventListener("click", () => runOne(t));
      li.appendChild(runBtn);
      ul.appendChild(li);
    }
  }
}

function bind(id, key, transform = (v) => v) {
  $(id).addEventListener("change", (e) => {
    state[key] = transform(e.target.value);
    persist();
  });
}

bind("baseUrl", "baseUrl", (v) => v.trim());
bind("email", "email", (v) => v.trim());
bind("password", "password");
bind("loggedInMarker", "loggedInMarker", (v) => v.trim());

$("btnSelectAll").addEventListener("click", () => {
  state.selectedIds = new Set(SAMPLE_TESTS.map((t) => t.id));
  persist();
  renderTestList();
});
$("btnSelectNone").addEventListener("click", () => {
  state.selectedIds = new Set();
  persist();
  renderTestList();
});

$("btnRunSelected").addEventListener("click", () => {
  const tests = SAMPLE_TESTS.filter((t) => state.selectedIds.has(t.id));
  if (!tests.length) return appendLog("err", "no tests selected");
  runSuite(tests);
});

function runOne(test) {
  runSuite([test]);
}

function runSuite(tests) {
  appendLog("info", `▶ running ${tests.length} test(s)`);
  $("report").innerHTML = "";
  $("reportSummary").textContent = "running…";
  chrome.runtime.sendMessage({
    type: MSG.RUN_SUITE,
    payload: {
      tests,
      vars: {
        baseUrl: state.baseUrl,
        email: state.email,
        password: state.password,
        loggedInMarker: state.loggedInMarker,
      },
    },
  }).catch((err) => appendLog("err", err.message || String(err)));
}

$("btnNgrok").addEventListener("click", async () => {
  const reply = await chrome.runtime.sendMessage({ type: MSG.GET_NGROK_URL });
  if (reply?.url) {
    await navigator.clipboard.writeText(reply.url);
    appendLog("ok", `ngrok url copied: ${reply.url}`);
  } else {
    appendLog("warn", "ngrok tunnel not detected on :4040");
  }
});

$("btnDownload").addEventListener("click", () => {
  if (!state.lastReport) return;
  const blob = new Blob([JSON.stringify(state.lastReport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `novaspay-rpa-${state.lastReport.startedAt.replace(/[:.]/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === MSG.RUN_LOG) {
    appendLog(msg.payload.level, msg.payload.message);
  } else if (msg?.type === MSG.RUN_REPORT) {
    state.lastReport = msg.payload;
    renderReport(msg.payload);
    $("btnDownload").disabled = false;
  }
  return false;
});

function renderReport(report) {
  const ol = $("report");
  ol.innerHTML = "";
  const s = report.summary;
  $("reportSummary").textContent = `${s.passed}/${s.total} passed · ${s.failed} failed · ${s.skipped} skipped · ${report.finishedAt}`;

  for (const t of report.tests) {
    const li = document.createElement("li");
    li.className = `report-row ${t.status}`;

    const head = document.createElement("div");
    head.className = "report-head";
    head.innerHTML = `<span class="badge">${t.status.toUpperCase()}</span>
      <span class="module">${t.module}</span>
      <span class="name">${escapeHtml(t.name)}</span>
      <span class="dur">${t.durationMs}ms</span>`;
    li.appendChild(head);

    if (t.error) {
      const e = document.createElement("div");
      e.className = "report-err";
      e.textContent = t.error;
      li.appendChild(e);
    }

    if (t.assertionResults?.length) {
      const list = document.createElement("ul");
      list.className = "asserts";
      for (const a of t.assertionResults) {
        const ai = document.createElement("li");
        ai.className = a.ok ? "ok" : "fail";
        ai.textContent = `${a.ok ? "✓" : "✗"} [${a.type}] ${a.label} — expected=${JSON.stringify(a.expected)} actual=${JSON.stringify(a.actual)} ${a.error || ""}`;
        list.appendChild(ai);
      }
      li.appendChild(list);
    }
    ol.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function appendLog(level, message) {
  const li = document.createElement("li");
  li.className = level;
  li.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  const ol = $("logs");
  ol.appendChild(li);
  ol.scrollTop = ol.scrollHeight;
}

load();