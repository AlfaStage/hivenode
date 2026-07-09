// ==============================================================================
// API Route: POST /api/auth/logout
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { removeAuthCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await removeAuthCookie();
    return NextResponse.redirect(new URL("/login", request.url));
  } catch (error) {
    console.error("[API] Logout error:", error);
    return NextResponse.redirect(new URL("/login", request.url));
  }
}
