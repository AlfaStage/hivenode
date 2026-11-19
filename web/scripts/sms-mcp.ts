import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const key = process.env.HIVENODE_SMS_API_KEY;
if (!key?.match(/^smsk_[a-f0-9]{64}$/)) throw new Error("Configure HIVENODE_SMS_API_KEY com a chave do painel.");
const base = new URL(process.env.HIVENODE_SMS_URL || "https://hivenode.alfastage.com.br");
const loopback = base.protocol === "http:" && base.hostname === "127.0.0.1";
if ((!loopback && base.protocol !== "https:") || base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
  throw new Error("HIVENODE_SMS_URL deve ser uma origem HTTPS ou um servidor de teste em 127.0.0.1.");
}

const server = new McpServer({ name: "hivenode-sms", version: "1.0.0" });

async function api(path: string, method = "GET", body?: object, requestKey?: string) {
  try {
    const response = await fetch(new URL("/api/sms/pilot" + path, base), {
      method, redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { authorization: "Bearer " + key, "content-type": "application/json",
        ...(requestKey ? { "idempotency-key": requestKey } : {}) },
      body: body && JSON.stringify(body),
    });
    const { data, error } = await response.json();
    return { isError: !response.ok, content: [{
      type: "text" as const, text: JSON.stringify(response.ok ? data : { status: response.status, error }),
    }] };
  } catch {
    return { isError: true, content: [{
      type: "text" as const,
      text: "Sem resposta da API. Se uma solicitação foi interrompida, consulte o histórico ou reutilize a mesma chave de idempotência.",
    }] };
  }
}

server.registerTool("listar_aparelhos_sms", {
  description: "Veja os aparelhos e os chips da conta. O campo sims informa o simId de cada chip no gateway.",
  inputSchema: {},
  annotations: { readOnlyHint: true },
}, () => api(""));

server.registerTool("consultar_sms", {
  description: "Veja o status de um envio HiveNode SMS e os retornos do Android.",
  inputSchema: { id: z.uuid() },
  annotations: { readOnlyHint: true },
}, ({ id }) => api("/messages?id=" + encodeURIComponent(id)));

server.registerTool("enfileirar_sms", {
  description: "Após confirmação explícita do usuário, enfileire um SMS real. No gateway informe simId e consentConfirmed=true.",
  inputSchema: {
    deviceId: z.uuid().optional(), simId: z.uuid().optional(), consentConfirmed: z.literal(true).optional(),
    destination: z.string().regex(/^\+55[1-9]\d{9,10}$/),
    text: z.string().trim().min(1).max(420), idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/),
    confirmed: z.literal(true),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
}, ({ deviceId, simId, consentConfirmed, destination, text, idempotencyKey }) => {
  if (simId && !deviceId && consentConfirmed) return api("/messages", "POST", { simId, consentConfirmed, destination, text }, idempotencyKey);
  if (deviceId && !simId) return api("/messages", "POST", { deviceId, destination, text }, idempotencyKey);
  return { isError: true, content: [{ type: "text" as const, text: "Informe simId e consentConfirmed=true para o gateway." }] };
});

server.registerTool("listar_contatos_sms", {
  description: "Consulte os contatos que receberam SMS de um chip ou os descadastros da conta.",
  inputSchema: { simId: z.uuid().optional(), optedOut: z.literal(true).optional(), after: z.uuid().optional() },
  annotations: { readOnlyHint: true },
}, ({ simId, optedOut, after }) => {
  const query = new URLSearchParams();
  if (simId) query.set("simId", simId);
  if (optedOut) query.set("optedOut", "true");
  if (after) query.set("after", after);
  return api("/contacts?" + query.toString());
});

server.registerTool("cancelar_sms", {
  description: "Cancele um SMS que ainda está na fila. Um envio já autorizado não pode ser cancelado.",
  inputSchema: { id: z.uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
}, ({ id }) => api("/messages", "PATCH", { id, action: "cancel" }));

void server.connect(new StdioServerTransport()).catch(() => {
  process.stderr.write("Não foi possível iniciar o MCP HiveNode SMS.\n");
  process.exitCode = 1;
});
