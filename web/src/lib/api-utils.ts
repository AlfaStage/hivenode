export function apiError(message: string, status: number = 400) {
  if (status === 500) {
    console.error(JSON.stringify({ level: "error", message }));
  }
  return Response.json({ error: message, success: false }, { status });
}

export function apiSuccess<T>(data: T, status: number = 200) {
  return new Response(JSON.stringify({ data, success: true, error: null }, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function handleApiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro interno";
  const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
  return apiError(status === 500 ? "Erro interno do servidor" : message, status);
}

export function generateSecureString(length: number = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}
