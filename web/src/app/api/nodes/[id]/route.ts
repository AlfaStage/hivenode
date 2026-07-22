import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/api-utils";

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
      await fetch(`http://broker:10001/kick?nodeId=${resolvedParams.id}`);
    } catch (e) {
      console.log("Aviso: Broker inatingível ou aparelho já offline.");
    }

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("Erro ao deletar node:", error);
    return apiError("Erro ao remover aparelho", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await requireAuth();
    const resolvedParams = await params;
    
    const body = await request.json();
    const newName = body.deviceName;
    const newTags = body.tags;
    
    if (newName === undefined && newTags === undefined) return apiError("Nenhuma alteração enviada", 400);

    const node = await prisma.node.findUnique({ where: { id: resolvedParams.id } });
    if (!node || node.userId !== payload.userId) {
      return apiError("Aparelho não encontrado", 404);
    }

    const dataToUpdate: any = {};
    if (newName !== undefined) dataToUpdate.deviceModel = newName;
    if (newTags !== undefined) dataToUpdate.tags = newTags;

    // Atualiza no banco de dados
    await prisma.node.update({
      where: { id: node.id },
      data: dataToUpdate
    });

    // Avisa o Go Broker pra espalhar o novo nome (PC e Celular)
    try {
      await fetch("http://broker:10001/internal/rename-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: node.id, newName })
      });
    } catch (e) {
      console.log("Aviso: Broker inatingível para webhook de rename.");
    }

    return apiSuccess({ updated: true });
  } catch (error) {
    console.error("Erro ao renomear node:", error);
    return apiError("Erro ao renomear aparelho", 500);
  }
}
