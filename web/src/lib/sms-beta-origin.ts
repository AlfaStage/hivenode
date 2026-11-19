export function isSmsBetaSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("authorization")?.startsWith("Bearer ") ?? false;
  return origin === new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin;
}
