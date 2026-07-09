import { NextRequest } from "next/server";
import { requireAuth, generateQrLinkToken } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/utils";
import os from "os";

function getHostIp(request: NextRequest) {
  // Em produção, o App móvel deve se conectar através do domínio ponte da API (onde a porta 10000 tá liberada)
  if (process.env.NODE_ENV === "production") {
    return "api.hivenode.alfastage.com.br";
  }
  
  // No ambiente de dev local, tenta adivinhar o IP da máquina
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
