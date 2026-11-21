import { HiOutlinePencilSquare } from "react-icons/hi2";
import { figureDataUri } from "@/lib/figures/svg";
import type { DocBlock, DocModel } from "@/modules/documents/client";
import { cn } from "@/lib/utils";

/**
 * La hoja tal como sale en el PDF (ADR-0009): se dibuja desde el mismo modelo intermedio, así lo
 * que el docente ve es lo que va a imprimir. Todo el texto es texto plano (nunca HTML).
 */
export function DocPreview({
  model,
  className,
  onEdit,
}: {
  model: DocModel;
  className?: string;
  /** "Editar" junto a cada pregunta o actividad: abre el editor en ese ítem. */
  onEdit?: (itemId: string) => void;
}) {
  return (
    <article
      aria-label={`Vista del documento: ${model.title}`}
      data-testid="doc-preview"
      className={cn(
        "flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-5 text-[15px] leading-relaxed text-foreground shadow-soft sm:p-8",
        className,
      )}
    >
      {model.institutionLine && (
        <p className="text-sm font-semibold text-muted-foreground">{model.institutionLine}</p>
      )}
      <header className="flex flex-col gap-0.5">
        {model.draft && (
          <span className="w-fit rounded border border-border px-1.5 text-xs font-bold tracking-widest text-muted-foreground">
            BORRADOR
          </span>
        )}
        {/* El título del documento no es un encabezado de la página (ya lo es el del recurso). */}
        <p className="text-xl font-extrabold">{model.title}</p>
        {model.subtitle && <p className="text-sm text-muted-foreground">{model.subtitle}</p>}
      </header>
      {model.header.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 border-y border-border py-2 text-sm sm:grid-cols-2">
          {model.header.map((h) => (
            <div key={h.label} className="flex gap-1.5">
              <dt className="font-semibold">{h.label}:</dt>
              <dd>{h.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {model.studentFields.length > 0 && (
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {model.studentFields.map((f) => (
            <p key={f}>
              {f}: <span className="inline-block w-40 border-b border-muted-foreground" />
            </p>
          ))}
        </div>
      )}
      {model.blocks.map((b, i) => (
        <Block key={i} block={b} onEdit={onEdit} />
      ))}
    </article>
  );
}

function Lines({ count, indent }: { count: number; indent?: boolean }) {
  if (!count) return null;
  return (
    <div aria-hidden className={cn("flex flex-col gap-4 pt-3", indent && "pl-4")}>
      {Array.from({ length: Math.min(count, 4) }, (_, i) => (
        <span key={i} className="block border-b border-border" />
      ))}
    </div>
  );
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full px-2 text-sm font-medium text-brand hover:bg-brand-softer focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none print:hidden"
    >
      <HiOutlinePencilSquare aria-hidden className="size-4" />
      <span className="max-sm:sr-only">Editar</span>
    </button>
  );
}

function Block({ block: b, onEdit }: { block: DocBlock; onEdit?: (itemId: string) => void }) {
  switch (b.kind) {
    case "heading":
      return b.level === 1 ? (
        <h3 className="pt-2 text-lg font-extrabold">{b.text}</h3>
      ) : (
        <h4 className="pt-1 font-bold">{b.text}</h4>
      );
    case "paragraph":
      return (
        <p
          className={cn(
            "whitespace-pre-line",
            b.tone === "muted" && "text-muted-foreground italic",
            b.tone === "strong" && "font-bold",
          )}
        >
          {b.text}
        </p>
      );
    case "list": {
      const List = b.ordered ? "ol" : "ul";
      return (
        <List className={cn("flex flex-col gap-1 pl-6", b.ordered ? "list-decimal" : "list-disc")}>
          {b.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </List>
      );
    }
    case "question":
      return (
        <div className="relative flex flex-col gap-1.5 py-1" data-doc-item={b.itemId}>
          {onEdit && b.itemId && (
            <div className="float-right -mt-1 ml-2">
              <EditButton label={`Editar pregunta ${b.number}`} onClick={() => onEdit(b.itemId!)} />
            </div>
          )}
          {b.context && <p className="whitespace-pre-line">{b.context}</p>}
          {b.figure && (
            // eslint-disable-next-line @next/next/no-img-element -- SVG propio en data:
            <img
              src={figureDataUri(b.figure)}
              alt={b.figure.alt}
              width={b.figure.width}
              height={b.figure.height}
              className="h-auto max-w-full self-start"
            />
          )}
          <p>
            <span className="font-bold">{b.number}. </span>
            {b.stem}
          </p>
          <ul className={cn("pl-4", b.inline ? "flex flex-wrap gap-x-8" : "flex flex-col gap-0.5")}>
            {b.options.map((o, i) => (
              <li key={i} className={cn(o.correct && "font-semibold text-success")}>
                {o.label} {o.text}
              </li>
            ))}
          </ul>
          <Lines count={b.answerLines} indent />
        </div>
      );
    case "activity":
      return (
        <div className="flex flex-col gap-1 py-1" data-doc-item={b.itemId}>
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold">{b.title}</p>
            {onEdit && b.itemId && (
              <EditButton label={`Editar ${b.title}`} onClick={() => onEdit(b.itemId!)} />
            )}
          </div>
          <p className="whitespace-pre-line">{b.instructions}</p>
          {(b.extras ?? []).map((x, i) => (
            <p key={i} className="whitespace-pre-line">
              {x}
            </p>
          ))}
          {b.details.map((d, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              {d}
            </p>
          ))}
          <Lines count={b.answerLines} />
        </div>
      );
    case "keyTable":
      return (
        <Table
          columns={[
            { title: "N°", width: 8 },
            { title: "Respuesta", width: 46 },
            { title: "Justificación", width: 46, muted: true },
          ]}
          rows={b.rows.map((r) => [r.number, r.answer, r.explanation])}
        />
      );
    case "table":
      return <Table columns={b.columns} rows={b.rows} strongRows={b.strongRows} />;
  }
}

function Table({
  columns,
  rows,
  strongRows,
}: {
  columns: { title: string; width: number; muted?: boolean; center?: boolean }[];
  rows: string[][];
  strongRows?: number[];
}) {
  const strong = new Set(strongRows ?? []);
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.title}
                style={{ width: `${c.width}%` }}
                className={cn(
                  "border-b border-border px-1 py-1 text-left",
                  c.center && "text-center",
                )}
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className={cn(strong.has(r) && "font-bold")}>
              {row.map((cell, c) => (
                <td
                  key={c}
                  className={cn(
                    "border-b border-border px-1 py-1 align-top whitespace-pre-line",
                    columns[c]?.muted && "text-muted-foreground",
                    columns[c]?.center && "text-center",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
