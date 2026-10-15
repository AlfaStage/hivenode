"use client";
import { useCallback, useEffect, useState } from "react";
import type { AdminUser } from "@/lib/admin-types";
export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(() => fetch("/api/admin").then(async response => {
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "Não foi possível carregar os usuários");
    setUsers(result.data.users || []);
    setError("");
  }).catch(error => setError(error instanceof Error ? error.message : "Falha de conexão"))
    .finally(() => setLoading(false)), []);
  useEffect(() => { void reload(); }, [reload]);
  return { users, loading, error, reload };
}
