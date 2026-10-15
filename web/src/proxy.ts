import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export async function proxy(request: NextRequest) {
  try {
    const token = request.cookies.get("hivenode-token")?.value;
    if (!token) return NextResponse.redirect(new URL("/login", request.url));
    const payload = await verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true, disabled: true, sessionVersion: true } });
    if (!user || user.disabled || user.sessionVersion !== payload.version) return NextResponse.redirect(new URL("/login", request.url));
    const path = request.nextUrl.pathname;
    if (path.startsWith("/admin")) {
      if (user.role !== "ADMIN" || payload.scope === "device") return NextResponse.redirect(new URL("/dashboard", request.url));
      return NextResponse.redirect(new URL("/dashboard" + path, request.url));
    }
    if (path.startsWith("/miner")) return NextResponse.redirect(new URL("/dashboard" + path, request.url));
    return NextResponse.next();
  } catch { return NextResponse.redirect(new URL("/login", request.url)); }
}
export const config = { matcher: ["/saas/:path*", "/miner/:path*", "/admin/:path*"] };
