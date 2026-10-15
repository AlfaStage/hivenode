// ==============================================================================
// API Route: POST /api/auth/logout
// ==============================================================================

import { NextResponse } from "next/server";
import { removeAuthCookie } from "@/lib/auth";

export async function POST() {
  try {
    await removeAuthCookie();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Logout error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
