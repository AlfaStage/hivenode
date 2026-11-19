type SmsBetaIdentity = { role: string; smsBetaAccess: boolean; scope?: unknown };

export function canAccessSmsBeta(user: SmsBetaIdentity | null | undefined): boolean {
  return Boolean(user && user.scope === "web" && (user.role === "ADMIN" || user.smsBetaAccess));
}
