import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { NodeStatus } from "@prisma/client";
import { brokerCommand } from "@/lib/broker";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    if (!["ONLINE", "OFFLINE", "BLOCKED"].includes(body.status)) return apiError("Status inválido", 400);

    const node = await prisma.node.update({
      where: { id },
      data: {
        status: body.status as NodeStatus,
      },
    });

    if (body.status === "BLOCKED") await brokerCommand("/internal/revoke", { nodeId: id }).catch(console.error);
    return apiSuccess({ node: { ...node, tunnelSecret: undefined } });
  } catch (error: unknown) {
    console.error("[API Admin Node Edit]", error);
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    await prisma.node.delete({
      where: { id },
    });
    await brokerCommand("/internal/revoke", { nodeId: id }).catch(console.error);

    return apiSuccess({ message: "Aparelho excluído com sucesso." });
  } catch (error: unknown) {
    console.error("[API Admin Node Delete]", error);
    return handleApiError(error);
  }
}
