export function normalizeRole(role?: string | null): string {
  return role?.toLowerCase().trim() ?? ''
}

export function isAdminRole(role?: string | null): boolean {
  const normalized = normalizeRole(role)
  return normalized === 'admin' || normalized === 'administrador'
}

export function isGuardRole(role?: string | null): boolean {
  const normalized = normalizeRole(role)
  return normalized === 'guard' || normalized === 'guardia'
}

export function getRoleHomePath(role?: string | null): string {
  return isGuardRole(role) ? '/guardia' : '/dashboard'
}
