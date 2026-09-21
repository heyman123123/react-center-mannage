# NovasPay Admin RPA — Chrome Extension (MV3)

A minimal but real Chrome (MV3) Side Panel extension that drives NovasPay Admin
in the browser, calls the admin API, and runs step-based flows.

## Layout

```
tools/novaspay-rpa-extension/
├── manifest.json                 # MV3 manifest, Side Panel + content + SW
├── package.json
├── scripts/build.mjs             # 0-dependency copy bundler
├── src/
│   ├── background/service-worker.js
│   ├── content/runner.js
│   ├── sidepanel/{index.html, panel.js, style.css}
│   └── lib/{api.js, flow.js, messages.js}
└── dist/                         # load this in chrome://extensions
```

## Load in Chrome

1. `cd tools/novaspay-rpa-extension && npm run build`
2. Open `chrome://extensions/`, enable **Developer mode**.
3. **Load unpacked** → pick `tools/novaspay-rpa-extension/dist/`.
4. Pin the action, then click it (or `chrome.sidePanel.open`) to open the side panel.

## Step DSL

```json
{
  "id": "my-flow",
  "name": "Demo",
  "steps": [
    { "type": "navigate",  "url": "{{baseUrl}}/payment-channels/{{channelId}}" },
    { "type": "waitFor",   "selector": "[data-rpa=send-test-webhook]", "timeoutMs": 10000 },
    { "type": "click",     "selector": "[data-rpa=send-test-webhook]" },
    { "type": "api",       "baseUrl": "{{baseUrl}}", "path": "/api/v1/payment-webhooks",
                          "query": { "channelId": "{{channelId}}" }, "expectStatus": 200, "intoKey": "webhooks" }
  ]
}
```

| Step        | Notes                                                                  |
|-------------|------------------------------------------------------------------------|
| navigate    | Goes to URL; next step waits for load                                  |
| click       | CSS selector; waits up to 10s                                          |
| type        | Sets `value` via native setter, dispatches input/change events         |
| waitFor     | Polls `querySelector` up to `timeoutMs`                                |
| sleep       | Just `await sleep(ms)`                                                 |
| screenshot  | Placeholder — wire to `chrome.tabs.captureVisibleTab` if needed        |
| extract     | Reads text or attribute into `ctx.vars[intoKey]`                       |
| api         | Made by background SW (auth, CORS-safe); result goes to `ctx.vars`     |

Variables use `{{varName}}` and are merged from the side panel (`baseUrl`,
`token`, `fromIso`, `toIso`, plus any custom keys).

## Notes / TODO

- Icons under `assets/` are not shipped — drop PNGs there before publishing.
- The Creem sample flow expects admin pages to mark the test-webhook button
  with `data-rpa=send-test-webhook` so the script is resilient to UI changes.
- `screenshot` is a no-op stub; add `chrome.tabs.captureVisibleTab` in SW.
- `host_permissions` is currently wide-open; tighten to your admin origin.