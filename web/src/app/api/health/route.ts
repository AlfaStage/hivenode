// ==============================================================================
// API Route: GET /api/health
// ==============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export async function GET() {
  try {
    // Tenta fazer um count básico para validar conexão com o DB
    await Promise.all([prisma.user.count(), redis.ping()]);
    
    return NextResponse.json(
      { status: "ok", service: "hivenode-web" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[HealthCheck] Falha na conexão com BD:", error);
    return NextResponse.json(
      { status: "error", message: "Dependency connection failed" },
      { status: 500 }
    );
  }
}
