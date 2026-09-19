#!/usr/bin/env bash
# Tunnel local Admin API (:8080) for Creem Webhooks via ngrok.
set -euo pipefail

PORT="${NOVAS_HTTP_PORT:-8080}"
ROOT_URL="http://127.0.0.1:${PORT}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok 未安装。执行: brew install ngrok/ngrok/ngrok" >&2
  exit 1
fi

if ! curl -sf -m 2 "${ROOT_URL}/healthz" >/dev/null; then
  echo "API 未在 ${ROOT_URL} 就绪。先在 backend 目录执行: make run" >&2
  exit 1
fi

# Optional one-shot auth from env (never commit the token).
if [ -n "${NGROK_AUTHTOKEN:-}" ]; then
  ngrok config add-authtoken "${NGROK_AUTHTOKEN}" >/dev/null
fi

# Merge default agent config (authtoken) with project tunnel definition.
DEFAULT_CFG="${HOME}/Library/Application Support/ngrok/ngrok.yml"
if [ ! -f "${DEFAULT_CFG}" ]; then
  DEFAULT_CFG="${HOME}/.config/ngrok/ngrok.yml"
fi

echo "转发 ${ROOT_URL} → 公网 HTTPS"
echo "Creem Webhook 填: https://<ngrok-host>/api/v1/hooks/creem/<channelId>"
echo "本地检查隧道: http://127.0.0.1:4040"
echo

if [ -f "${DEFAULT_CFG}" ]; then
  exec ngrok start --config "${DEFAULT_CFG}" --config "${SCRIPT_DIR}/ngrok.yml" novas-api
fi

# No saved authtoken yet — still attempt; ngrok will print how to add one.
exec ngrok http "${PORT}"
