// Roles y comprobaciones puras. El contexto de tenant que las usa vive en modules/tenancy.

export const ROLES = ["ADMIN", "TEACHER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  TEACHER: "Docente",
};

export function hasRole(roles: readonly Role[], role: Role): boolean {
  return roles.includes(role);
}
