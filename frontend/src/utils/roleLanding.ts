export type AppRole = 'developer' | 'tenant_owner' | 'distributor' | 'user' | string;

export function normalizeRole(raw: string | null | undefined): AppRole {
  if (!raw) return '';
  const r = raw.toLowerCase();
  if (['instance_owner','owner','admin'].includes(r)) return 'tenant_owner';
  return r as AppRole;
}

export function landingPath(role: AppRole): string {
  switch (normalizeRole(role)) {
    case 'developer': return '/dev';
  case 'tenant_owner': return '/admin';
    case 'distributor': return '/admin/dashboard';
    default: return '/';
  }
}

export function decodeRoleFromToken(token: string): AppRole | '' {
  try {
    const part = token.split('.')[1];
    const json = JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));
    return normalizeRole(json?.role);
  } catch { return ''; }
}
