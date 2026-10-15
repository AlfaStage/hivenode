const script = `#!/bin/sh
set -eu
PANEL_URL="\${HIVE_PANEL_URL:-http://127.0.0.1:8080}"
CONFIG_FILE="\${HIVE_CONFIG_FILE:-/data/config.json}"
command -v curl >/dev/null 2>&1 || { echo "Instale curl." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "Instale jq." >&2; exit 1; }
TOKEN="\${HIVE_PANEL_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -f "$CONFIG_FILE" ]; then TOKEN=$(jq -r '.panelToken // empty' "$CONFIG_FILE"); fi
[ -n "$TOKEN" ] || { echo "Configure HIVE_PANEL_TOKEN com o token do HiveDocker." >&2; exit 1; }
api() {
  route="$1"
  if [ "$#" -eq 1 ]; then
    curl -fsS --max-time 20 -H "Authorization: Bearer $TOKEN" "$PANEL_URL/api$route"
  else
    curl -fsS --max-time 20 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2" "$PANEL_URL/api$route"
  fi
}
show() { result=$(api "$@") || return; printf '%s\\n' "$result" | jq .; }
case "\${1:-help}" in
  status) show /status ;;
  start) show /tunnel/start '{}'; show /status ;;
  stop) show /tunnel/stop '{}' ;;
  logout) show /logout '{}' ;;
  auth)
    result=$(api /auth/start '{}')
    code=$(printf '%s' "$result" | jq -er '.data.deviceCode')
    printf '%s' "$result" | jq -r '"Abra: " + .data.verificationUri, "Código: " + .data.userCode'
    count=0
    while [ "$count" -lt 60 ]; do
      sleep 5
      result=$(api /auth/poll "$(jq -nc --arg code "$code" '{deviceCode:$code}')")
      if [ "$(printf '%s' "$result" | jq -r '.data.status')" = success ]; then
        echo "Aparelho registrado. Estado atual do túnel:"
        show /status; exit 0
      fi
      count=$((count + 1))
    done
    echo "Código expirado. Execute hivecli auth novamente." >&2; exit 1
    ;;
  *) echo "Uso: hivecli {auth|status|start|stop|logout}"
     echo "Requer HiveDocker, HIVE_PANEL_URL e HIVE_PANEL_TOKEN." ;;
esac
`;

export async function GET() {
  return new Response(script, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
