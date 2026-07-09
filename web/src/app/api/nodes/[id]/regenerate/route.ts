import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { apiError, apiSuccess, generateSecureString } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) return apiError("Unauthorized", 401);

    const token = authHeader.split(" ")[1];
    const payload = await verifyToken(token);

    const node = await prisma.node.findUnique({
      where: { id: params.id }
    });

    if (!node || node.userId !== payload.userId) {
      return apiError("Node não encontrado", 404);
    }

    const newPass = generateSecureString(16);

    const updatedNode = await prisma.node.update({
      where: { id: params.id },
      data: { proxyPass: newPass }
    });

    console.log(`[API Nodes] Senha regenerada para o node: ${updatedNode.id}`);
    return apiSuccess({ node: updatedNode });
  } catch (error) {
    console.error("[API Nodes] Erro ao regenerar senha:", error);
    return apiError("Erro interno", 500);
  }
}
