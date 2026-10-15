import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { brokerCommand } from "@/lib/broker";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth();
    const resolvedParams = await params;
    
    // Verifica se o Node pertence ao usuário
    const node = await prisma.node.findFirst({
      where: { id: resolvedParams.id, userId: payload.userId }
    });

    if (!node) return apiError("Aparelho não encontrado", 404);

    await prisma.node.delete({ where: { id: resolvedParams.id } });

    // Informa ao Broker Go interno para derrubar o aparelho da memória
    try {
      // Aciona o webhook do Broker na porta 10001 para derrubar o WS se estiver online
      await brokerCommand("/internal/revoke", { nodeId: resolvedParams.id });
    } catch {
      console.log("Aviso: Broker inatingível ou aparelho já offline.");
    }

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("Erro ao deletar node:", error);
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await requireAuth();
    const resolvedParams = await params;
    
    const body = z.object({ deviceName: z.string().trim().min(1).max(100).optional(), tags: z.array(z.string().trim().min(1).max(50)).max(20).optional() }).parse(await request.json());
    const newName = body.deviceName;
    const newTags = body.tags;
    
    if (newName === undefined && newTags === undefined) return apiError("Nenhuma alteração enviada", 400);

    const node = await prisma.node.findUnique({ where: { id: resolvedParams.id } });
    if (!node || node.userId !== payload.userId) {
      return apiError("Aparelho não encontrado", 404);
    }

    const dataToUpdate: Prisma.NodeUpdateInput = {};
    if (newName !== undefined) dataToUpdate.deviceModel = newName;
    if (newTags !== undefined) dataToUpdate.tags = newTags;

    // Atualiza no banco de dados
    await prisma.node.update({
      where: { id: node.id },
      data: dataToUpdate
    });

    // Avisa o Go Broker pra espalhar o novo nome (PC e Celular)
    try {
      if (typeof newName === "string") await brokerCommand("/internal/rename-node", { nodeId: node.id, newName });
    } catch {
      console.log("Aviso: Broker inatingível para webhook de rename.");
    }

    return apiSuccess({ updated: true });
  } catch (error) {
    console.error("Erro ao renomear node:", error);
    return handleApiError(error);
  }
}
