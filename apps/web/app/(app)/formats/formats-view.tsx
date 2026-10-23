"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  HiOutlineArrowUpTray,
  HiOutlineDocumentText,
  HiOutlinePencilSquare,
  HiOutlineStar,
  HiOutlineTrash,
  HiStar,
} from "react-icons/hi2";
import { sileo } from "sileo";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import {
  type FormatProposal,
  type FormatScope,
  type FormatView,
  type LogoInfo,
  type SaveFormatInput,
} from "@/modules/formats/client";
import { useRun } from "../courses/[courseId]/planning/use-run";
import { FormatEditor } from "./format-editor";

type Actions = {
  save: (input: SaveFormatInput) => Promise<ActionResult<{ id: string }>>;
  setDefault: (input: { formatId: string; isDefault: boolean }) => Promise<ActionResult>;
  remove: (input: { formatId: string }) => Promise<ActionResult>;
  removeLogo: (input: Record<string, never>) => Promise<ActionResult>;
};

type Props = {
  formats: FormatView[];
  logo: LogoInfo | null;
  logoVersion: string;
  /** Formatos que puede crear: los suyos y, si administra un colegio, los institucionales. */
  scopes: FormatScope[];
  canManageLogo: boolean;
  actions: Actions;
};

type Editing =
  { kind: "new"; proposal: FormatProposal } | { kind: "edit"; format: FormatView } | null;

async function upload(url: string, file: File) {
  const body = new FormData();
  body.set("file", file);
  const response = await fetch(url, { method: "POST", body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "No pudimos procesar el archivo");
  return data;
}

function LogoPanel({
  logo,
  version,
  remove,
}: {
  logo: LogoInfo | null;
  version: string;
  remove: Actions["removeLogo"];
}) {
  const router = useRouter();
  const { run, isPending } = useRun();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4" aria-labelledby="logo-title">
      <h2 id="logo-title" className="font-medium">
        Logo o escudo
      </h2>
      <p className="text-sm text-muted-foreground">
        Aparece en el encabezado de todos los documentos que descargas. PNG o JPG, máximo 500 KB.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagen privada servida por la app
          <img
            src={`/formats/logo?v=${version}`}
            alt="Logo actual"
            className="h-14 w-auto rounded border bg-white p-1"
          />
        ) : (
          <span className="text-sm text-muted-foreground">Sin logo.</span>
        )}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          aria-label="Subir logo"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            try {
              await upload("/formats/logo", file);
              sileo.success({ title: "Logo actualizado" });
              router.refresh();
            } catch (error) {
              sileo.error({
                title: "No pudimos subir el logo",
                description: (error as Error).message,
              });
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <HiOutlineArrowUpTray aria-hidden />
          {logo ? "Cambiar logo" : "Subir logo"}
        </Button>
        {logo && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => run(() => remove({}), "Logo eliminado")}
          >
            Quitar
          </Button>
        )}
      </div>
    </section>
  );
}

export function FormatsView({ formats, logo, logoVersion, scopes, canManageLogo, actions }: Props) {
  const router = useRouter();
  const { run, isPending } = useRun();
  const [editing, setEditing] = useState<Editing>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const own = formats.filter((f) => f.scope === "TEACHER");
  const school = formats.filter((f) => f.scope === "INSTITUTION");

  if (editing) {
    const initial =
      editing.kind === "new"
        ? { name: editing.proposal.name, scope: scopes[0]!, structure: editing.proposal.structure }
        : {
            id: editing.format.id,
            name: editing.format.name,
            scope: editing.format.scope,
            structure: editing.format.structure,
          };
    return (
      <FormatEditor
        initial={initial}
        warnings={editing.kind === "new" ? editing.proposal.warnings : []}
        aiUsed={editing.kind === "new" ? editing.proposal.aiUsed : undefined}
        scopes={editing.kind === "new" ? scopes : [editing.format.scope]}
        save={actions.save}
        onDone={() => {
          setEditing(null);
          router.refresh();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const list = (items: FormatView[], label: string) => (
    <ul className="flex flex-col gap-2" aria-label={label}>
      {items.map((f) => (
        <li
          key={f.id}
          className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center"
        >
          <div className="flex flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2 font-semibold">
              {f.name}
              {f.isDefault && <Badge variant="brand">Predeterminado</Badge>}
            </span>
            <span className="text-sm text-muted-foreground">
              {f.structure.sections.map((s) => s.title).join(" · ")}
            </span>
            <span className="text-xs text-muted-foreground">
              {f.structure.header.length} campos en el encabezado ·{" "}
              {f.structure.sections.filter((s) => s.kind === "ACTIVITIES").length} con actividades
            </span>
          </div>
          {f.canEdit && (
            <span className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={
                  f.isDefault
                    ? `Quitar ${f.name} como predeterminado`
                    : `Usar ${f.name} como predeterminado`
                }
                disabled={isPending}
                onClick={() =>
                  run(() => actions.setDefault({ formatId: f.id, isDefault: !f.isDefault }))
                }
              >
                {f.isDefault ? <HiStar aria-hidden /> : <HiOutlineStar aria-hidden />}
                Predeterminado
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditing({ kind: "edit", format: f })}
              >
                <HiOutlinePencilSquare aria-hidden />
                Editar
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Eliminar ${f.name}`}
                disabled={isPending}
                onClick={() => run(() => actions.remove({ formatId: f.id }), "Formato eliminado")}
              >
                <HiOutlineTrash aria-hidden />
              </Button>
            </span>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-6">
      {canManageLogo && <LogoPanel logo={logo} version={logoVersion} remove={actions.removeLogo} />}

      <section
        className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6"
        aria-labelledby="formats-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="formats-title" className="text-lg font-extrabold">
            Formatos de taller
          </h2>
          <input
            ref={input}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            aria-label="Subir formato en Word"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setAnalyzing(true);
              try {
                setEditing({ kind: "new", proposal: await upload("/formats/analyze", file) });
              } catch (error) {
                sileo.error({
                  title: "No pudimos leer el formato",
                  description: (error as Error).message,
                });
              } finally {
                setAnalyzing(false);
              }
            }}
          />
          <Button type="button" disabled={analyzing} onClick={() => input.current?.click()}>
            <HiOutlineArrowUpTray aria-hidden />
            {analyzing ? "Analizando el formato…" : "Subir formato (Word)"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Sube tu guía o taller en Word: Profe detecta el encabezado y las secciones, tú los revisas
          y tus talleres se generan y descargan con esa estructura. El archivo no se guarda.
        </p>
        {own.length > 0 ? (
          list(own, "Mis formatos")
        ) : (
          <EmptyState
            icon={HiOutlineDocumentText}
            title="Todavía no tienes formatos propios"
            description="Sin formato, los talleres salen con una estructura estándar de inicio, desarrollo y cierre."
            action={
              <Button
                type="button"
                variant="outline"
                disabled={analyzing}
                onClick={() => input.current?.click()}
              >
                Subir mi primer formato
              </Button>
            }
          />
        )}
        {school.length > 0 && (
          <>
            <h3 className="mt-2 text-sm font-bold">Formatos del colegio</h3>
            {list(school, "Formatos del colegio")}
          </>
        )}
      </section>
    </div>
  );
}
