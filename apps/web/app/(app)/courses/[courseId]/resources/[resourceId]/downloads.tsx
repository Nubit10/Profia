"use client";

import { useState } from "react";
import {
  HiOutlineArrowDownTray,
  HiOutlineCheckCircle,
  HiOutlineDocumentText,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { SelectableOption } from "@/components/forms/selectable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { VARIANTS } from "@/modules/documents/client";
import type { ResourceType } from "@/modules/resources/client";

type Doc = "student" | "key" | "answers";
type Format = "pdf" | "docx";
type Prefs = { format: Format; docs: Doc[]; variants: number };

type Props = {
  courseId: string;
  resourceId: string;
  type: ResourceType;
  version: number;
  /** SPEC-0011 RN-15: el examen tiene hoja de respuestas si trae selección múltiple o V/F. */
  answerSheet?: boolean;
  /** SPEC-0013 RN-07: un borrador sale con la marca "BORRADOR"; se avisa antes de descargar. */
  draft: boolean;
  /** Marca el recurso como listo; `true` si se pudo. */
  markReady: () => Promise<boolean>;
};

/** Preferencias de descarga por dispositivo (RN-06): de UI, no de dominio. */
const PREFS_KEY = "profe:descargas";
const DEFAULT_PREFS: Prefs = { format: "pdf", docs: ["student", "key"], variants: 1 };

function readPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<Prefs> | null;
    if (!saved) return DEFAULT_PREFS;
    return {
      format: saved.format === "docx" ? "docx" : "pdf",
      docs: Array.isArray(saved.docs) && saved.docs.length > 0 ? saved.docs : DEFAULT_PREFS.docs,
      variants: Math.min(Math.max(Number(saved.variants) || 1, 1), VARIANTS.length),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Sin almacenamiento la próxima vez se usan los valores por defecto.
  }
}

/** Descarga con un enlace temporal: el servidor responde con `attachment`, la página no cambia. */
function startDownload(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}

/**
 * SPEC-0009: descargas en Word y PDF; quiz y examen pueden salir en varias versiones (RN-07).
 * SPEC-0013 RN-06/07: un solo diálogo con formato, qué incluir y versiones, que baja todo en un
 * archivo, y que avisa del borrador antes de descargar.
 */
export function Downloads(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="lg" onClick={() => setOpen(true)}>
        <HiOutlineArrowDownTray aria-hidden />
        Descargar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Descargar</DialogTitle>
            <DialogDescription>
              Elige el formato y qué incluir. Si es más de un archivo, bajan juntos en un .zip.
            </DialogDescription>
          </DialogHeader>
          {/* El formulario se monta al abrir: lee las preferencias del dispositivo sin desfasar la
              hidratación (RN-09). */}
          {open && <DownloadForm {...props} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DownloadForm(props: Props & { onDone: () => void }) {
  const { type, draft } = props;
  const [prefs, setPrefs] = useState(readPrefs);
  const [busy, setBusy] = useState(false);
  const [showSingles, setShowSingles] = useState(false);
  const withVariants = type !== "WORKSHOP";
  const [studentLabel, keyLabel] =
    type === "WORKSHOP"
      ? ["Guía del estudiante", "Guía del docente"]
      : ["Hoja del estudiante", "Clave"];
  const docOptions: { doc: Doc; label: string; hint: string }[] = [
    { doc: "student", label: studentLabel, hint: "Para entregar" },
    { doc: "key", label: keyLabel, hint: "Solo para ti" },
    ...(props.answerSheet
      ? [{ doc: "answers" as const, label: "Hoja de respuestas", hint: "Para marcar A–D" }]
      : []),
  ];
  const docs = prefs.docs.filter((d) => docOptions.some((o) => o.doc === d));
  const variants = withVariants ? prefs.variants : 1;
  const base = `/courses/${props.courseId}/resources/${props.resourceId}/export`;

  const update = (next: Partial<Prefs>) => {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    savePrefs(merged);
  };

  const single = (doc: Doc, format: Format, variant = "A") =>
    `${base}?doc=${doc}&format=${format}&version=${props.version}&variant=${variant}`;
  const url =
    docs.length === 1 && variants === 1
      ? single(docs[0]!, prefs.format)
      : `${base}/bundle?docs=${docs.join(",")}&format=${prefs.format}&variants=${variants}&version=${props.version}`;

  const download = async (markReady: boolean) => {
    if (docs.length === 0) return;
    setBusy(true);
    if (markReady && !(await props.markReady())) {
      setBusy(false);
      return;
    }
    startDownload(url);
    setBusy(false);
    props.onDone();
  };

  const fileCount =
    docs.filter((d) => d !== "answers").length * variants + (docs.includes("answers") ? 1 : 0);

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold">Formato</legend>
        <div role="radiogroup" aria-label="Formato" className="grid grid-cols-2 gap-2">
          {(
            [
              ["pdf", "PDF", "Para imprimir"],
              ["docx", "Word", "Para editar"],
            ] as const
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={prefs.format === value}
              onClick={() => update({ format: value })}
              className={cn(
                "flex min-h-12 flex-col items-start rounded-2xl border border-border px-4 py-2 text-left transition hover:border-brand-border hover:bg-brand-softer",
                prefs.format === value && "border-brand bg-brand-softer ring-2 ring-brand",
              )}
            >
              <span className="font-bold">{label}</span>
              <span className="text-xs text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold">Qué incluir</legend>
        {/* Tarjetas en cuadrícula, como las de formato: nunca filas a todo el ancho del modal. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
          {docOptions.map(({ doc, label, hint }) => {
            const id = `download-${doc}`;
            return (
              <SelectableOption
                key={doc}
                id={id}
                checked={docs.includes(doc)}
                onCheckedChange={(checked) =>
                  update({
                    docs: checked ? [...docs, doc] : docs.filter((d) => d !== doc),
                  })
                }
                description={hint}
                className="h-full"
              >
                {label}
              </SelectableOption>
            );
          })}
        </div>
        {docs.length === 0 && (
          <p className="text-sm text-danger" role="alert">
            Elige al menos un documento.
          </p>
        )}
      </fieldset>

      {withVariants && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-bold">Versiones para evitar la copia</legend>
          <div
            role="radiogroup"
            aria-label="Versiones para evitar la copia"
            className="grid grid-cols-4 gap-2"
          >
            {VARIANTS.map((_, index) => {
              const n = index + 1;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={variants === n}
                  aria-label={n === 1 ? "1 versión" : `${n} versiones`}
                  onClick={() => update({ variants: n })}
                  className={cn(
                    "min-h-11 rounded-xl border border-border font-bold transition hover:border-brand-border hover:bg-brand-softer",
                    variants === n && "border-brand bg-brand-softer ring-2 ring-brand",
                  )}
                >
                  {n === 1 ? "A" : `A–${VARIANTS[index]}`}
                </button>
              );
            })}
          </div>
          {variants > 1 && (
            <p className="text-xs text-muted-foreground">
              {type === "EXAM"
                ? "Cada versión cambia el orden de las preguntas dentro de cada sección y el de las opciones, y tiene su propia clave."
                : "Cada versión cambia el orden de las preguntas y de las opciones, y tiene su propia clave."}
            </p>
          )}
        </fieldset>
      )}

      {draft && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning-soft p-3 text-sm"
        >
          <HiOutlineExclamationTriangle className="mt-0.5 shrink-0 text-warning" aria-hidden />
          Este recurso está en borrador: los documentos salen con la marca «BORRADOR». Si ya lo
          revisaste, márcalo como listo.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {draft ? (
          <>
            <Button
              type="button"
              variant="brand"
              size="xl"
              disabled={busy || docs.length === 0}
              onClick={() => void download(true)}
            >
              <HiOutlineCheckCircle aria-hidden />
              Marcar como listo y descargar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={busy || docs.length === 0}
              onClick={() => void download(false)}
            >
              Descargar con marca de borrador
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="brand"
            size="xl"
            disabled={busy || docs.length === 0}
            onClick={() => void download(false)}
          >
            <HiOutlineArrowDownTray aria-hidden />
            {fileCount > 1 ? `Descargar ${fileCount} archivos (.zip)` : "Descargar"}
          </Button>
        )}
      </div>

      {/* Para quien necesita un solo archivo de una versión puntual. */}
      <div className="rounded-2xl border border-border">
        <button
          type="button"
          aria-expanded={showSingles}
          onClick={() => setShowSingles((v) => !v)}
          className="flex min-h-11 w-full items-center px-4 text-left text-sm font-semibold"
        >
          Descargar un archivo suelto
        </button>
        {showSingles && (
          <ul
            className="flex flex-col gap-1 border-t border-border p-2"
            aria-label="Archivos sueltos"
          >
            {(withVariants ? VARIANTS.slice(0, variants) : (["A"] as const)).flatMap((v) => {
              const suffix = variants > 1 ? ` (versión ${v})` : "";
              return docOptions
                .filter((o) => o.doc !== "answers" || v === "A")
                .flatMap(({ doc, label }) =>
                  (["pdf", "docx"] as const).map((format) => {
                    const name = `${label}${doc === "answers" ? "" : suffix} en ${format === "pdf" ? "PDF" : "Word"}`;
                    return (
                      <li key={`${v}-${doc}-${format}`}>
                        <a
                          href={single(doc, format, v)}
                          download
                          aria-label={name}

                          className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm hover:bg-muted"
                        >
                          <HiOutlineDocumentText aria-hidden />
                          <span className="flex-1">{name}</span>
                        </a>
                      </li>
                    );
                  }),
                );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
