import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HiOutlineFolderOpen, HiOutlineSparkles } from "react-icons/hi2";
import { ProfeLogo } from "@/components/brand/profe-logo";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Sistema de diseño" };

const COLORS = [
  ["brand-from", "bg-brand-from"],
  ["brand-via", "bg-brand-via"],
  ["brand-to / brand", "bg-brand"],
  ["brand-strong", "bg-brand-strong"],
  ["brand-soft", "bg-brand-soft"],
  ["surface", "bg-surface"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["danger", "bg-danger"],
  ["info", "bg-info"],
] as const;

const TINTS = [
  ["bg-tint-1", "text-tint-1-fg"],
  ["bg-tint-2", "text-tint-2-fg"],
  ["bg-tint-3", "text-tint-3-fg"],
  ["bg-tint-4", "text-tint-4-fg"],
  ["bg-tint-5", "text-tint-5-fg"],
  ["bg-tint-6", "text-tint-6-fg"],
] as const;

/** Catálogo del sistema de diseño (SPEC-0012). Solo en desarrollo. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-12">
      <PageHeader
        eyebrow="SPEC-0012"
        title="Sistema de diseño de Profe"
        description="Tokens y componentes. Detalle y reglas en docs/design/sistema-de-diseno.md."
      />
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-extrabold">Marca</h2>
        <ProfeLogo />
        <div className="h-16 rounded-2xl bg-brand-gradient" />
        <p className="text-4xl font-extrabold">
          <span className="text-brand-gradient">Titular con degradado</span> y texto normal
        </p>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-extrabold">Colores</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {COLORS.map(([name, cls]) => (
            <li key={name} className="flex flex-col gap-2 text-sm">
              <span className={`h-14 rounded-xl ring-1 ring-border ${cls}`} />
              {name}
            </li>
          ))}
        </ul>
        <h3 className="font-bold">Tintes por asignatura</h3>
        <ul className="flex flex-wrap gap-3">
          {TINTS.map(([bg, fg]) => (
            <li
              key={bg}
              className={`flex size-12 items-center justify-center rounded-xl font-extrabold ${bg} ${fg}`}
            >
              M
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-extrabold">Botones</h2>
        <p className="text-sm text-muted-foreground">
          `brand` es la acción primaria: máximo uno por pantalla (RN-01).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="brand" size="lg">
            <HiOutlineSparkles aria-hidden />
            Generar taller
          </Button>
          <Button size="lg">Continuar</Button>
          <Button variant="outline" size="lg">
            Volver
          </Button>
          <Button variant="ghost" size="lg">
            Cancelar
          </Button>
          <Button variant="destructive" size="lg">
            Eliminar
          </Button>
        </div>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-extrabold">Badges y campos</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="brand">Borrador</Badge>
          <Badge variant="success">Listo</Badge>
          <Badge variant="info">Generando</Badge>
          <Badge variant="warning">Falló</Badge>
          <Badge variant="outline">Taller</Badge>
        </div>
        <Input placeholder="Ej.: Fracciones equivalentes" className="max-w-sm" />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-extrabold">Estado vacío</h2>
        <EmptyState
          icon={HiOutlineFolderOpen}
          title="Aún no has creado talleres ni quices"
          description="Una línea que explica qué es esto y por qué está vacío."
          action={<Button variant="outline">Una acción concreta</Button>}
        />
      </section>
    </main>
  );
}
