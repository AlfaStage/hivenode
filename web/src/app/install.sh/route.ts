import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host") || "hivenode.alfastage.com.br";
  const protocol = request.headers.get("x-forwarded-proto") || "https";

  const script = `#!/bin/sh
# ==============================================================================
# HiveNode / HiveMiner — Universal Linux Installer
# ==============================================================================
# Suporta qualquer distribuição Linux (Debian, Ubuntu, CentOS, RHEL, Arch, Alpine)
# ==============================================================================

set -e

BASE_URL="${protocol}://${host}"
TOKEN=""
CODE=""

for arg in "$@"; do
  case $arg in
    --token=*)
      TOKEN="\${arg#*=}"
      shift
      ;;
    --code=*)
      CODE="\${arg#*=}"
      shift
      ;;
  esac
done

echo "🐝 [HiveNode/HiveMiner] Instalando o cliente universal de nó..."

# Checagem de dependências básicas (curl ou wget)
if command -v curl >/dev/null 2>&1; then
  FETCH_CMD="curl -fsSL"
elif command -v wget >/dev/null 2>&1; then
  FETCH_CMD="wget -qO-"
else
  echo "❌ Erro: Instale 'curl' ou 'wget' para continuar."
  exit 1
fi

INSTALL_DIR="/usr/local/bin"
mkdir -p "$INSTALL_DIR"

# Baixar o script de gerenciamento CLI
$FETCH_CMD "$BASE_URL/cli.sh" > "$INSTALL_DIR/hivenode-cli"
chmod +x "$INSTALL_DIR/hivenode-cli"
ln -sf "$INSTALL_DIR/hivenode-cli" "$INSTALL_DIR/hiveminer-cli"

echo "✅ Binários 'hivenode-cli' e 'hiveminer-cli' instalados em $INSTALL_DIR!"

if [ -n "$TOKEN" ]; then
  echo "🔗 Vinculando automaticamente usando o token fornecido..."
  hivenode-cli link --token="$TOKEN"
elif [ -n "$CODE" ]; then
  echo "🔗 Vinculando automaticamente usando o código $CODE..."
  hivenode-cli link --code="$CODE"
else
  echo ""
  echo "=============================================================================="
  echo "💡 Instalação concluída sem vínculo automático!"
  echo "Para vincular este aparelho com sua conta HiveNode, execute:"
  echo "  hivenode-cli link --code SUAS_6_LETRAS"
  echo "  (Exemplo: hivenode-cli link --code HV-8X92)"
  echo "=============================================================================="
fi
`;

  return new Response(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
