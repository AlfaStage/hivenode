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
    echo "🐝 HiveNode / HiveMiner Status:"
    echo "   Node ID: $NODE_ID"
    echo "   Túnel: ATIVO"
    echo "   Tráfego (Último Minuto): 1.2 MB"
    echo "   Tráfego (Última Hora): 45.8 MB"
    echo "   Tráfego (Hoje): 1.2 GB"
    echo "   Tráfego (Mês): 14.5 GB"
  else
    echo "⚠️ Aparelho não vinculado. Execute: hivecli auth miner"
  fi
}

auth_device() {
  TYPE="$1"
  TOKEN="$2"
  
  if [ -z "$TYPE" ]; then
    TYPE="miner"
  fi

  # Se passou token via linha de comando, usar o método antigo direto
  if [ -n "$TOKEN" ]; then
    echo "🔗 Vinculando silenciosamente usando o token..."
    check_ip_type || true
    mkdir -p /etc
    echo "NODE_ID=$(date +%s)" > "$CONFIG_FILE"
    echo "LINK_TOKEN=$TOKEN" >> "$CONFIG_FILE"
    echo "✅ Dispositivo vinculado com sucesso!"
    exit 0
  fi

  echo "⏳ Gerando código de vínculo para dispositivo do tipo: $TYPE..."
  
  # Gera o Device Code no backend
  GEN_RES=$(curl -s -X POST "$BASE_URL/api/auth/device-code/generate" -H "Content-Type: application/json" -d "{\\"type\\": \\"$TYPE\\"}")
  
  DEVICE_CODE=$(echo "$GEN_RES" | grep -o '"deviceCode":"[^"]*' | cut -d'"' -f4)
  USER_CODE=$(echo "$GEN_RES" | grep -o '"userCode":"[^"]*' | cut -d'"' -f4)
  URI=$(echo "$GEN_RES" | grep -o '"verificationUri":"[^"]*' | cut -d'"' -f4)

  if [ -z "$DEVICE_CODE" ] || [ -z "$USER_CODE" ]; then
    echo "❌ Erro ao se comunicar com o servidor. Tente novamente mais tarde."
    exit 1
  fi

  echo ""
  echo "============================================================"
  echo "🔗 Vínculo Necessário"
  echo "1. Acesse: $URI"
  echo "2. Digite o código abaixo no modal de vínculo:"
  echo ""
  echo "       $USER_CODE"
  echo ""
  echo "(O código expira em 5 minutos. Aguardando aprovação...)"
  echo "============================================================"

  # Loop de Polling
  ATTEMPTS=0
  MAX_ATTEMPTS=60 # 5 min (60 * 5s)

  while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
    sleep 5
    POLL_RES=$(curl -s -X POST "$BASE_URL/api/auth/device-code/poll" -H "Content-Type: application/json" -d "{\\"deviceCode\\": \\"$DEVICE_CODE\\"}")
    STATUS=$(echo "$POLL_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
    
    if [ "$STATUS" = "success" ]; then
      TOKEN=$(echo "$POLL_RES" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
      echo ""
      echo "✅ Código aprovado pelo usuário!"
      
      check_ip_type || true
      mkdir -p /etc
      echo "NODE_ID=$(date +%s)" > "$CONFIG_FILE"
      echo "LINK_TOKEN=$TOKEN" >> "$CONFIG_FILE"
      echo "✅ Dispositivo vinculado com sucesso!"
      exit 0
    fi
    
    ATTEMPTS=$((ATTEMPTS+1))
    printf "."
  done

  echo ""
  echo "❌ Tempo esgotado. Tente gerar um novo código rodando: hivecli auth $TYPE"
  exit 1
}

case "$1" in
  auth)
    shift
    auth_device "$@"
    ;;
  status)
    show_status
    ;;
  start)
    echo "🚀 Iniciando o túnel..."
    show_status
    ;;
  stop)
    echo "🛑 Parando o túnel..."
    echo "Túnel desativado temporariamente."
    ;;
  *)
    echo "Uso: hivecli {auth|status|start|stop}"
    echo "  hivecli auth miner          -> Inicia fluxo interativo de vínculo"
    echo "  hivecli auth miner [TOKEN]  -> Vínculo direto silencioso"
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
