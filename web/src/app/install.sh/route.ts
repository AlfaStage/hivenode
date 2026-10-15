export async function GET() {
  const base = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://hivenode.alfastage.com.br");
  const download = "'" + new URL("/cli.sh", base).href.replaceAll("'", "'\"'\"'") + "'";
  const script = [
    "#!/bin/sh", "set -eu",
    "command -v curl >/dev/null 2>&1 || { echo 'Instale curl.' >&2; exit 1; }",
    "command -v jq >/dev/null 2>&1 || { echo 'Instale jq.' >&2; exit 1; }",
    'INSTALL_DIR="${HIVE_INSTALL_DIR:-/usr/local/bin}"',
    'mkdir -p "$INSTALL_DIR"',
    'TEMP_FILE=$(mktemp "$INSTALL_DIR/.hivecli.XXXXXX")',
    'trap \'rm -f -- "$TEMP_FILE"\' EXIT',
    'curl -fsS --max-time 30 ' + download + ' -o "$TEMP_FILE"',
    'chmod 755 "$TEMP_FILE"',
    'mv -- "$TEMP_FILE" "$INSTALL_DIR/hivecli"',
    "echo 'hivecli instalado. Requer HiveDocker em execução e HIVE_PANEL_TOKEN.'",
  ].join("\n") + "\n";
  return new Response(script, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
