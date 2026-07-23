import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-utils";
import { getSystemSettings, updateSystemSettings } from "@/lib/settings";

export async function GET() {
  try {
    await requireAdmin();
    const settings = getSystemSettings();
    return apiSuccess({ settings });
  } catch (error) {
    return apiError("Erro ao carregar configurações do sistema", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    const updated = updateSystemSettings(body);
    return apiSuccess({ settings: updated, message: "Configurações salvas com sucesso!" });
  } catch (error) {
    return apiError("Erro ao atualizar configurações", 500);
  }
}
