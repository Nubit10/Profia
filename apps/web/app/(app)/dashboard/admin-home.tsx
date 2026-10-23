import Link from "next/link";
import { HiOutlineBuildingLibrary, HiOutlineUserGroup } from "react-icons/hi2";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";

/** Inicio del administrador que no da clases (SPEC-0012 §7): su siguiente paso es de colegio. */
export function AdminHome({ spaceName, canManage }: { spaceName: string; canManage: boolean }) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Inicio" title={spaceName} description="Administra tu colegio." />
      <section
        aria-labelledby="next-step"
        className="relative overflow-hidden rounded-3xl border border-brand-border bg-card p-6 shadow-soft sm:p-8"
      >
        <div aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-brand-gradient" />
        <p className="text-sm font-bold text-brand-strong">Siguiente paso</p>
        <h2 id="next-step" className="mt-1 text-xl font-extrabold sm:text-2xl">
          Invita a tus profesores
        </h2>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Cada profesor crea sus cursos y su material con el formato y el logo del colegio. Si
          también das clases, actívate el rol de docente en Profesores.
        </p>
        {canManage && (
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/school/members"
              className={buttonVariants({ variant: "brand", size: "lg" })}
            >
              <HiOutlineUserGroup aria-hidden />
              Invitar profesores
            </Link>
            <Link href="/school" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <HiOutlineBuildingLibrary aria-hidden />
              Datos y sedes
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
