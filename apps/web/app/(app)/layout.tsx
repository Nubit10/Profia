import { AppShell } from "@/components/app-shell/app-shell";
import type { QuotaView } from "@/components/app-shell/identity-card";
import { logger } from "@/lib/observability/logger";
import { logoutAction } from "@/modules/auth";
import { getLogoInfo } from "@/modules/formats";
import { getQuotaStatus } from "@/modules/resources";
import {
  isSchoolAdmin,
  requireTenant,
  switchSpaceAction,
  type TenantContext,
} from "@/modules/tenancy";

// RN-01 (SPEC-0001) y ADR-0004: todo lo que cuelga de este grupo exige sesión y un espacio activo
// validado en el servidor. Las páginas vuelven a llamar requireTenant(): un layout no se
// re-renderiza en cada navegación.

// ADR-0008 y ADR-0011: las generaciones corren con after() dentro de la misma función. 300 s es el
// máximo que admite Vercel en todos sus planes; los timeouts del AI Engine quedan por debajo.
export const maxDuration = 300;

const timeFormat = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

/** RN-12 (SPEC-0012): el cupo sale del servidor. Si falla, el menú se muestra sin él. */
async function quotaView(ctx: TenantContext): Promise<QuotaView | null> {
  if (!ctx.roles.includes("TEACHER")) return null;
  try {
    const quota = await getQuotaStatus(ctx);
    return {
      used: quota.used,
      limit: quota.limit,
      freesAtLabel: quota.freesAt ? timeFormat.format(quota.freesAt) : null,
    };
  } catch (error) {
    logger.warn("shell.quota_unavailable", { error });
    return null;
  }
}

async function logoUrl(ctx: TenantContext): Promise<string | null> {
  try {
    const logo = await getLogoInfo(ctx);
    return logo ? `/formats/logo?v=${logo.updatedAt.getTime()}` : null;
  } catch (error) {
    logger.warn("shell.logo_unavailable", { error });
    return null;
  }
}

function roleLabel(ctx: TenantContext) {
  if (ctx.institutionType === "INDEPENDENT") return "Independiente";
  if (ctx.roles.includes("ADMIN")) return "Administrador";
  return "Docente";
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireTenant();
  const [quota, logo] = await Promise.all([quotaView(ctx), logoUrl(ctx)]);

  return (
    <AppShell
      identity={{
        spaceName: ctx.institutionName,
        logoUrl: logo,
        userName: ctx.userName,
        roleLabel: roleLabel(ctx),
      }}
      access={{ isTeacher: ctx.roles.includes("TEACHER"), isSchoolAdmin: isSchoolAdmin(ctx) }}
      quota={quota}
      spaces={ctx.spaces.map(({ institutionId, name, type }) => ({ institutionId, name, type }))}
      activeSpaceId={ctx.institutionId}
      logoutAction={logoutAction}
      switchSpaceAction={switchSpaceAction}
    >
      {children}
    </AppShell>
  );
}
