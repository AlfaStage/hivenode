import { NextRequest } from "next/server";
import { requireAuth, generateQrLinkToken } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/utils";
import os from "os";

function getHostIp(request: NextRequest) {
  // Se tiver um domínio de produção configurado, usa ele
  if (process.env.NEXT_PUBLIC_DOMAIN) {
    return process.env.NEXT_PUBLIC_DOMAIN;
  }
  
  // Tenta pegar o Host do header da requisição
  const host = request.headers.get("host")?.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return host;
  }

  // Descobre o IP da rede local automaticamente
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    if (nets[name]) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  }
  return 'localhost';
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const token = await generateQrLinkToken(user.userId);
    const ip = getHostIp(request);
    
    return apiSuccess({ linkToken: token, ip });
  } catch {
    return apiError("Não autorizado", 401);
  }
}
