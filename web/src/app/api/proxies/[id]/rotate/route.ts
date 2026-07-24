import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiError, apiSuccess, generateSecureString } from "@/lib/api-utils";
import { redis } from "@/lib/redis";
import { bcryptHash, encrypt } from "@/lib/crypto";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth();
    const { id } = await params;
    
    const proxy = await prisma.proxyCredential.findUnique({
      where: { id },
      include: { node: { select: { id: true } } }
    });
    
    if (!proxy || proxy.userId !== payload.userId) {
      return apiError("Proxy não encontrado", 404);
    }
    
    const newPass = generateSecureString(16);
    const hashed = await bcryptHash(newPass);
    const encryptedRedis = encrypt(newPass);
    
    await prisma.proxyCredential.update({
      where: { id },
      data: { proxyPass: hashed }
    });
    
    // Atualiza Redis atomicamente
    await redis.set(`proxy:${proxy.proxyUser}`, `${proxy.node.id}:${encryptedRedis}`);
    
    return apiSuccess({
      proxyUser: proxy.proxyUser,
      proxyPass: newPass, // só esta resposta mostra plaintext
      rotated: true
    });
  } catch (error) {
    console.error("[rotate-proxy] Erro:", error);
    return apiError("Erro ao rotar senha", 500);
  }
}
