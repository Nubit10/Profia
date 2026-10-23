import "server-only";

// API pública del módulo tenancy (ADR-0004): contexto del espacio activo y comprobaciones de rol.
export {
  getTenantContext,
  isSchoolAdmin,
  listActiveSpaces,
  pickActiveSpace,
  requireRole,
  requireSchoolAdmin,
  requireTenant,
  resolveTenantContext,
  type SpaceSummary,
  type SpaceType,
  type TenantContext,
} from "./context";
export { setActiveSpaceCookie } from "./cookie";
export { switchSpaceAction } from "./actions";
