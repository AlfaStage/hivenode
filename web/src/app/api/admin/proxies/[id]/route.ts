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

    const proxy = await prisma.proxyCredential.update({
      where: { id },
      data: {
        status: body.status as NodeStatus,
      },
    });

    if (body.status === "BLOCKED") await brokerCommand("/internal/revoke", { proxyId: id }).catch(console.error);
    return apiSuccess({ proxy: { ...proxy, proxyPass: undefined, passwordEncrypted: undefined } });
  } catch (error: unknown) {
    console.error("[API Admin Proxy Edit]", error);
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

    await prisma.proxyCredential.delete({
      where: { id },
    });
    await brokerCommand("/internal/revoke", { proxyId: id }).catch(console.error);

    return apiSuccess({ message: "Proxy excluído com sucesso." });
  } catch (error: unknown) {
    console.error("[API Admin Proxy Delete]", error);
    return handleApiError(error);
  }
}
