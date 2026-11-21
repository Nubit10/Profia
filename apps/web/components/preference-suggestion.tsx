"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HiOutlineLightBulb } from "react-icons/hi2";
import { sileo } from "sileo";
import { SelectableOption } from "@/components/forms/selectable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import type { PendingSuggestion } from "@/modules/resources/client";

const TITLE = "Lucía aprendió algo de ti";

type Props = {
  suggestion: PendingSuggestion;
  accept: (input: unknown) => Promise<ActionResult<{ preferenceId: string }>>;
  decline: (input: unknown) => Promise<ActionResult>;
};

/** El formulario: texto editable, alcance y, si choca con otra, desactivarla. */
function SuggestionForm({
  suggestion,
  accept,
  decline,
  idPrefix,
  onDone,
}: Props & { idPrefix: string; onDone: () => void }) {
  const router = useRouter();
  const [text, setText] = useState(suggestion.text);
  const [scope, setScope] = useState<"COURSE" | "ALL">(suggestion.course ? "COURSE" : "ALL");
  const [replace, setReplace] = useState(!!suggestion.conflictsWith);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const finish = (title: string) => {
    sileo.success({ title });
    onDone();
    router.refresh();
  };

  const use = () =>
    start(async () => {
      const result = await accept({
        suggestionId: suggestion.id,
        text,
        scope,
        courseId: scope === "COURSE" ? (suggestion.course?.id ?? null) : null,
        deactivateIds: replace && suggestion.conflictsWith ? [suggestion.conflictsWith.id] : [],
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      finish("Listo: la tendremos en cuenta de ahora en adelante");
    });

  const skip = () =>
    start(async () => {
      const result = await decline({ suggestionId: suggestion.id });
      if (!result.ok) {
        sileo.error({ title: "No pudimos guardar tu respuesta", description: result.error });
        return;
      }
      finish("Entendido: no te la volveremos a proponer");
    });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground" data-testid="suggestion-reason">
        {suggestion.reason}
      </p>
      <Field data-invalid={!!error}>
        <FieldLabel htmlFor={`${idPrefix}-text`}>Lucía lo tendrá en cuenta así</FieldLabel>
        <Textarea
          id={`${idPrefix}-text`}
          value={text}
          maxLength={300}
          rows={2}
          aria-invalid={!!error}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
        />
        <FieldError errors={[error ? { message: error } : undefined]} />
      </Field>
      {suggestion.course && (
        <div
          role="group"
          aria-label="¿Dónde aplica?"
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          <SelectableOption checked={scope === "COURSE"} onCheckedChange={() => setScope("COURSE")}>
            Solo en {suggestion.course.title}
          </SelectableOption>
          <SelectableOption checked={scope === "ALL"} onCheckedChange={() => setScope("ALL")}>
            En todos mis cursos
          </SelectableOption>
        </div>
      )}
      {suggestion.conflictsWith && (
        <SelectableOption
          checked={replace}
          onCheckedChange={setReplace}
          description={`Ahora tienes: «${suggestion.conflictsWith.text}»`}
        >
          Dejar de usar la indicación anterior, que dice lo contrario
        </SelectableOption>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" size="lg" disabled={pending} onClick={skip}>
          No, gracias
        </Button>
        <Button type="button" size="lg" disabled={pending || text.trim().length < 10} onClick={use}>
          Usar de ahora en adelante
        </Button>
      </div>
    </div>
  );
}

/**
 * SPEC-0021 Parte A: una preferencia que ProfIA propone a partir de lo que hace el docente. En
 * escritorio es una tarjeta; en el celular, una franja que abre una hoja inferior (Atrás la
 * cierra). Nada cambia hasta que el docente elige (teacher-in-control).
 */
export function PreferenceSuggestionCard(props: Props) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return null;
  const close = () => {
    setOpen(false);
    setDone(true);
  };

  return (
    <>
      <section
        aria-labelledby="suggestion-title"
        data-testid="preference-suggestion"
        className="flex flex-col gap-4 rounded-3xl border border-brand-border bg-card p-5 shadow-soft max-sm:hidden"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
            <HiOutlineLightBulb className="size-6" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="suggestion-title" className="font-bold">
              {TITLE}
            </h2>
            <p className="text-sm text-muted-foreground">
              Mirando lo que cambias en tus recursos, te proponemos tenerlo en cuenta al generar. Tú
              decides.
            </p>
          </div>
        </div>
        <SuggestionForm {...props} idPrefix="suggestion-card" onDone={close} />
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <button
          type="button"
          data-testid="preference-suggestion-open"
          onClick={() => setOpen(true)}
          className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-brand-border bg-card p-3 text-left shadow-soft sm:hidden"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
            <HiOutlineLightBulb className="size-5" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-bold">{TITLE}</span>
            <span className="truncate text-xs text-muted-foreground">{props.suggestion.text}</span>
          </span>
        </button>
        <DialogContent data-testid="preference-suggestion-sheet">
          <DialogHeader>
            <DialogTitle>{TITLE}</DialogTitle>
            <DialogDescription>
              Mirando lo que cambias en tus recursos, te proponemos tenerlo en cuenta al generar.
            </DialogDescription>
          </DialogHeader>
          <SuggestionForm {...props} idPrefix="suggestion-sheet" onDone={close} />
        </DialogContent>
      </Dialog>
    </>
  );
}
