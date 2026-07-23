// ==============================================================================
// API Route: GET /api/health
// ==============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Tenta fazer um count básico para validar conexão com o DB
    await prisma.user.count();
    
    return NextResponse.json(
      { status: "ok", service: "hivenode-web" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[HealthCheck] Falha na conexão com BD:", error);
    return NextResponse.json(
      { status: "error", message: "Database connection failed" },
      { status: 500 }
    );
  }
}
