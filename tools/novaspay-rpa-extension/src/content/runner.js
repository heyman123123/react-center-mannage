// src/content/runner.js
// Runs in every matched page. Answers ping, executes step payloads, evaluates assertions.
// Replies are sent on a new message so a long wait cannot close the Chrome message channel.

import { executeStep, runAssertions } from "../lib/flow.js";

if (!globalThis.__novaspayRpa) {
  globalThis.__novaspayRpa = true;

  const reply = (id, payload) => {
    chrome.runtime.sendMessage({
      type: "novaspay/page-result",
      payload: { id, ...payload },
    }).catch(() => {});
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return false;
    if (msg.type === "novaspay/ping") {
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === "novaspay/run-step") {
      const { id, step, ctx } = msg.payload || {};
      executeStep(step, ctx)
        .then((result) => {
          const ok = result?.ok !== false;
          reply(id, { ok, result, error: ok ? undefined : result?.error || "step failed" });
        })
        .catch((err) => reply(id, { ok: false, error: err.message || String(err) }));
      sendResponse({ accepted: true });
      return false;
    }
    if (msg.type === "novaspay/run-assertions") {
      const { id, assertions, vars } = msg.payload || {};
      runAssertions(assertions, vars)
        .then((results) => reply(id, { ok: true, results }))
        .catch((err) => reply(id, { ok: false, error: err.message || String(err) }));
      sendResponse({ accepted: true });
      return false;
    }
    return false;
  });
}
