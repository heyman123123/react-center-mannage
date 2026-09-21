// src/lib/messages.js
// Internal message types used between side panel / background / content scripts.

export const MSG = Object.freeze({
  OPEN_SIDE_PANEL: "novaspay/open-side-panel",
  SET_ACTIVE_TAB: "novaspay/set-active-tab",
  RUN_TEST: "novaspay/run-test",
  RUN_SUITE: "novaspay/run-suite",
  RUN_STEP: "novaspay/run-step",
  RUN_ASSERTIONS: "novaspay/run-assertions",
  RUN_LOG: "novaspay/run-log",
  RUN_REPORT: "novaspay/run-report",
  PAGE_RESULT: "novaspay/page-result",
  GET_NGROK_URL: "novaspay/get-ngrok-url",
  WAIT_HUMAN: "novaspay/wait-human",
  HUMAN_DONE: "novaspay/human-done",
});