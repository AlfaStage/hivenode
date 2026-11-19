type SmsBetaIdentity = { role: string; smsBetaAccess: boolean; scope?: unknown };

export function hasSmsBetaAccess(role: string, smsBetaAccess: boolean): boolean {
  return role === "ADMIN" || smsBetaAccess;
}

export function canAccessSmsBeta(user: SmsBetaIdentity | null | undefined): boolean {
  return Boolean(user && user.scope === "web" && hasSmsBetaAccess(user.role, user.smsBetaAccess));
}
