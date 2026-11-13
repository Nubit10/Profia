import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HiOutlineChevronRight, HiOutlineLockClosed, HiOutlineUser } from "react-icons/hi2";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { listMyCourses } from "@/modules/courses";
import { courseTitle } from "@/modules/courses/client";
import { createPiarAction, listPiars, piarEnabled } from "@/modules/piar";
import { requireTenant } from "@/modules/tenancy";
import { NewPiar } from "./new-piar";
import { PrivacyNotice } from "./privacy-notice";

// SPEC-0017: datos de menores; la página no se indexa ni se guarda en cachés compartidas.
export const metadata: Metadata = { title: "PIAR", robots: { index: false, follow: false } };

/** "PIAR" (SPEC-0017): los planes de ajustes razonables del docente, privados y cifrados. */
export default async function PiarListPage() {
  const ctx = await requireTenant();
  if (!ctx.roles.includes("TEACHER")) redirect("/dashboard");
  const enabled = piarEnabled();
  const [piars, courses] = await Promise.all([listPiars(ctx), listMyCourses(ctx)]);
  const options = courses.map((c) => ({ id: c.id, title: courseTitle(c) }));

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        eyebrow={ctx.institutionName}
        title="PIAR"
        description="Planes Individuales de Ajustes Razonables de tus estudiantes, para cuando la planeación con DUA no basta (Decreto 1421 de 2017)."
        actions={
          enabled && options.length > 0 ? (
            <NewPiar courses={options} create={createPiarAction} />
          ) : undefined
        }
      />
      <PrivacyNotice />

      {!enabled ? (
        <EmptyState
          icon={HiOutlineLockClosed}
          title="El PIAR no está disponible todavía"
          description="Falta configurar el cifrado de los datos en el servidor. Mientras tanto, Profe no guarda datos de estudiantes."
        />
      ) : options.length === 0 ? (
        <EmptyState
          icon={HiOutlineUser}
          title="Primero crea un curso"
          description="Cada PIAR es de un estudiante de uno de tus cursos."
          action={
            <Link href="/courses" className={buttonVariants({ variant: "outline" })}>
              Ir a Mis cursos
            </Link>
          }
        />
      ) : piars.length === 0 ? (
        <EmptyState
          icon={HiOutlineUser}
          title="Aún no tienes PIAR"
          description="Crea uno para un estudiante que necesita ajustes razonables. Profe te ayuda a proponerlos con IA."
        />
      ) : (
        <ul
          aria-label="Tus PIAR"
          className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
        >
          {piars.map((p) => (
            <li key={p.id}>
              <Link
                href={`/piar/${p.id}`}
                className="group flex items-center gap-3 p-4 transition hover:bg-brand-softer"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
                  <HiOutlineUser className="size-5" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold break-words">{p.studentName}</span>
                  <span className="text-sm text-muted-foreground">
                    {p.courseTitle} · Año {p.academicYear}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Actualizado {formatDateTime(p.updatedAt)}
                  </span>
                </span>
                <HiOutlineChevronRight
                  className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
