import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HiOutlineFolderOpen, HiOutlinePlus } from "react-icons/hi2";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ResourceList } from "@/components/resource-list";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listMyCourses } from "@/modules/courses";
import { courseTitle } from "@/modules/courses/client";
import { listMyResources } from "@/modules/resources";
import { RESOURCE_TYPES, type ResourceType } from "@/modules/resources/client";
import { requireTenant } from "@/modules/tenancy";

export const metadata: Metadata = { title: "Mis recursos" };

const TYPE_FILTERS: { value: ResourceType | null; label: string }[] = [
  { value: null, label: "Todos" },
  { value: "WORKSHOP", label: "Talleres" },
  { value: "QUIZ", label: "Quices" },
  { value: "EXAM", label: "Exámenes" },
];

function Chip({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
        active
          ? "border-brand bg-brand text-white shadow-soft"
          : "border-border bg-card text-foreground hover:border-brand-border hover:bg-brand-softer",
      )}
    >
      {children}
    </Link>
  );
}

/** "Mis recursos" (SPEC-0012 RN-13): los talleres y quices de todos los cursos del docente. */
export default async function MyResourcesPage({ searchParams }: PageProps<"/resources">) {
  const ctx = await requireTenant();
  if (!ctx.roles.includes("TEACHER")) redirect("/dashboard");

  const params = await searchParams;
  const type = RESOURCE_TYPES.find((t) => t === params.tipo) ?? null;
  const courses = await listMyCourses(ctx);
  const courseId = courses.find((c) => c.id === params.curso)?.id ?? null;
  const resources = await listMyResources(ctx, {
    ...(courseId ? { courseId } : {}),
    ...(type ? { type } : {}),
  });

  const href = (next: { tipo?: string | null; curso?: string | null }) => {
    const query = new URLSearchParams();
    const tipo = next.tipo === undefined ? type : next.tipo;
    const curso = next.curso === undefined ? courseId : next.curso;
    if (tipo) query.set("tipo", tipo);
    if (curso) query.set("curso", curso);
    const qs = query.toString();
    return qs ? `/resources?${qs}` : "/resources";
  };
  const filtered = !!type || !!courseId;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={ctx.institutionName}
        title="Mis recursos"
        description="Todos tus talleres y quices, de todos tus cursos."
        actions={
          <Link href="/create" className={buttonVariants({ size: "lg" })}>
            <HiOutlinePlus aria-hidden />
            Crear con IA
          </Link>
        }
      />

      <div className="flex flex-col gap-3">
        <nav aria-label="Filtrar por tipo" className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((f) => (
            <Chip key={f.label} href={href({ tipo: f.value })} active={type === f.value}>
              {f.label}
            </Chip>
          ))}
        </nav>
        {courses.length > 1 && (
          <nav aria-label="Filtrar por curso" className="flex flex-wrap gap-2">
            <Chip href={href({ curso: null })} active={!courseId}>
              Todos los cursos
            </Chip>
            {courses.map((c) => (
              <Chip key={c.id} href={href({ curso: c.id })} active={courseId === c.id}>
                {courseTitle(c)}
              </Chip>
            ))}
          </nav>
        )}
      </div>

      {resources.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={HiOutlineFolderOpen}
            title="No hay recursos con estos filtros"
            description="Prueba con otro tipo o con otro curso."
            action={
              <Link href="/resources" className={buttonVariants({ variant: "outline" })}>
                Quitar filtros
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={HiOutlineFolderOpen}
            title="Aún no has creado talleres ni quices"
            description="Con el botón Crear la IA te prepara uno en segundos y tú lo revisas."
            action={
              <Link href="/create?type=WORKSHOP" className={buttonVariants({ variant: "outline" })}>
                Crear mi primer taller
              </Link>
            }
          />
        )
      ) : (
        <ResourceList resources={resources} label="Mis recursos" showCourse />
      )}
    </div>
  );
}
