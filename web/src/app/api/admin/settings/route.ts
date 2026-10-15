import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiSuccess, handleApiError } from "@/lib/api-utils";
import { getSystemSettings, updateSystemSettings } from "@/lib/settings";

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getSystemSettings();
    return apiSuccess({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    const updated = await updateSystemSettings(body);
    return apiSuccess({ settings: updated, message: "Configurações salvas com sucesso!" });
  } catch (error) {
    return handleApiError(error);
  }
}
