import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host") || "hivenode.alfastage.com.br";
  const protocol = request.headers.get("x-forwarded-proto") || "https";

  const script = `#!/bin/sh
# ==============================================================================
# HiveNode / HiveMiner — Universal Linux Installer
# ==============================================================================

set -e

BASE_URL="${protocol}://${host}"

echo "🐝 [HiveNode/HiveMiner] Instalando o cliente universal hivecli..."

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

$FETCH_CMD "$BASE_URL/cli.sh" > "$INSTALL_DIR/hivecli"
chmod +x "$INSTALL_DIR/hivecli"

echo "✅ Binário 'hivecli' instalado em $INSTALL_DIR!"
echo ""
echo "💡 Para conectar seu aparelho, rode:"
echo "   hivecli auth miner"
echo "        ou"
echo "   hivecli auth node"
echo "=============================================================================="
`;

  return new Response(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
