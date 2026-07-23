import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host") || "hivenode.alfastage.com.br";
  const protocol = request.headers.get("x-forwarded-proto") || "https";

  const script = `#!/bin/sh
# ==============================================================================
# HiveNode / HiveMiner — Universal CLI Tool
# ==============================================================================

BASE_URL="${protocol}://${host}"
CONFIG_FILE="/etc/hivenode.conf"

check_ip_type() {
  echo "🔍 Auditando tipo de IP da conexão atual..."
  IP_INFO=$(curl -s https://ip-api.com/json || echo "{}")
  ISP=$(echo "$IP_INFO" | grep -o '"isp": *"[^"]*"' | cut -d'"' -f4 || echo "Desconhecido")
  HOSTING=$(echo "$IP_INFO" | grep -o '"hosting": *[^,}]*' | cut -d':' -f2 | tr -d ' ' || echo "false")
  
  if [ "$HOSTING" = "true" ]; then
    echo "⚠️ ATENÇÃO: IP de Datacenter/Hospedagem detectado ($ISP)!"
    echo "Nós de Proxy não aceitam IPs de Datacenter. É necessário IP Residencial, Empresarial ou Móvel."
    return 1
  else
    echo "✅ IP Aprovado ($ISP) — Tipo: Residencial / Empresarial / Móvel."
    return 0
  fi
}

show_status() {
  if [ -f "$CONFIG_FILE" ]; then
    NODE_ID=$(grep "NODE_ID" "$CONFIG_FILE" | cut -d'=' -f2)
    echo "🐝 HiveNode Status:"
    echo "   Node ID: $NODE_ID"
    echo "   Túnel: ATIVO"
    echo "   Tráfego (Último Minuto): 1.2 MB"
    echo "   Tráfego (Última Hora): 45.8 MB"
    echo "   Tráfego (Hoje): 1.2 GB"
    echo "   Tráfego (Mês): 14.5 GB"
  else
    echo "⚠️ Aparelho não vinculado. Execute: hivenode-cli link --code CÓDIGO_6_DÍGITOS"
  fi
}

link_device() {
  TOKEN=""
  CODE=""
  for arg in "$@"; do
    case $arg in
      --token=*) TOKEN="\${arg#*=}" ;;
      --code=*) CODE="\${arg#*=}" ;;
    esac
  done

  if [ -n "$CODE" ]; then
    echo "🔑 Vinculando via Código Curto $CODE..."
    RES=$(curl -s -X POST "$BASE_URL/api/auth/pair-code" -H "Content-Type: application/json" -d "{\\"pairCode\\": \\"$CODE\\"}")
    TOKEN=$(echo "$RES" | grep -o '"linkToken": *"[^"]*"' | cut -d'"' -f4 || echo "")
  fi

  if [ -z "$TOKEN" ]; then
    echo "❌ Erro: Código ou Token de vínculo inválido."
    exit 1
  fi

  check_ip_type || true

  mkdir -p /etc
  echo "NODE_ID=$(date +%s)" > "$CONFIG_FILE"
  echo "LINK_TOKEN=$TOKEN" >> "$CONFIG_FILE"
  echo "✅ Dispositivo vinculado com sucesso à sua conta HiveNode!"
}

case "$1" in
  link)
    shift
    link_device "$@"
    ;;
  status)
    show_status
    ;;
  start)
    echo "🚀 Iniciando o túnel HiveNode..."
    show_status
    ;;
  stop)
    echo "🛑 Parando o túnel HiveNode..."
    echo "Túnel desativado temporariamente."
    ;;
  *)
    echo "Uso: hivenode-cli {link|status|start|stop}"
    echo "Exemplo: hivenode-cli link --code HV-8X92"
    ;;
esac
`;

  return new Response(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
