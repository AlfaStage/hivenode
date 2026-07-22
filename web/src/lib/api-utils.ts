import { sendAdminErrorAlert } from "./email";

export function apiError(message: string, status: number = 400) {
  if (status === 500) {
    sendAdminErrorAlert(`API Erro Crítico (500): ${message}`).catch(console.error);
  }
  return Response.json({ error: message, success: false }, { status });
}

export function apiSuccess<T>(data: T, status: number = 200) {
  return Response.json({ data, success: true, error: null }, { status });
}
