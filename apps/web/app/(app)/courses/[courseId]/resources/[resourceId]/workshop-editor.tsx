"use client";

import { useState } from "react";
import { HiOutlinePencilSquare, HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { SelectField } from "@/components/forms/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  LEVELS,
  LEVEL_LABELS,
  type Activity,
  type ResourceDetail,
  type WorkshopContent,
} from "@/modules/resources/client";
import { ItemFeedback, RegenerateItem, type FeedbackActions } from "./item-tools";

const newId = () => `a-${Math.random().toString(36).slice(2, 10)}`;
const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export function ActivityView({ a, dba }: { a: Activity; dba: Map<string, number> }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        {a.title}{" "}
        <span className="font-normal text-muted-foreground">· {a.durationMinutes} min</span>
      </p>
      <p className="text-sm whitespace-pre-line">{a.instructions}</p>
      {a.expectedOutcome && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Producto esperado:</span> {a.expectedOutcome}
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline">{LEVEL_LABELS[a.cognitiveLevel]}</Badge>
        {a.dbaCodes.map((c) => (
          <Badge key={c} variant="secondary">
            DBA {dba.get(c) ?? c}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ActivityForm({ a, onChange }: { a: Activity; onChange: (a: Activity) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem_12rem]">
        <Field>
          <FieldLabel htmlFor={`${a.id}-title`}>Título</FieldLabel>
          <Input
            id={`${a.id}-title`}
            value={a.title}
            onChange={(e) => onChange({ ...a, title: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${a.id}-minutes`}>Minutos</FieldLabel>
          <Input
            id={`${a.id}-minutes`}
            type="number"
            min={1}
            max={180}
            value={a.durationMinutes}
            onChange={(e) => onChange({ ...a, durationMinutes: Number(e.target.value) || 1 })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${a.id}-level`}>Nivel</FieldLabel>
          <SelectField
            id={`${a.id}-level`}
            value={a.cognitiveLevel}
            onChange={(v) => onChange({ ...a, cognitiveLevel: v as Activity["cognitiveLevel"] })}
            options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor={`${a.id}-instructions`}>Instrucciones</FieldLabel>
        <Textarea
          id={`${a.id}-instructions`}
          rows={4}
          value={a.instructions}
          onChange={(e) => onChange({ ...a, instructions: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${a.id}-outcome`}>Producto esperado</FieldLabel>
        <Input
          id={`${a.id}-outcome`}
          value={a.expectedOutcome}
          onChange={(e) => onChange({ ...a, expectedOutcome: e.target.value })}
        />
      </Field>
    </div>
  );
}

type Props = {
  resource: ResourceDetail;
  content: WorkshopContent;
  onChange: (content: WorkshopContent) => void;
  dirty: boolean;
  savedKeys: Set<string>;
  actions: FeedbackActions;
};

export function WorkshopEditor({ resource, content, onChange, dirty, savedKeys, actions }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const dba = new Map(resource.context.dba.map((d) => [d.code, d.number]));
  const total = content.moments
    .flatMap((m) => m.activities)
    .reduce((s, a) => s + a.durationMinutes, 0);
  const setActivities = (momentIndex: number, activities: Activity[]) =>
    onChange({
      ...content,
      moments: content.moments.map((m, i) => (i === momentIndex ? { ...m, activities } : m)),
    });
  // Numeración continua de las actividades a través de los momentos.
  const numbers = new Map(
    content.moments.flatMap((m) => m.activities).map((a, i) => [a.id, i + 1]),
  );

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="ws-title">Título</FieldLabel>
        <Input
          id="ws-title"
          value={content.title}
          onChange={(e) => onChange({ ...content, title: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="ws-purpose">Propósito</FieldLabel>
        <Textarea
          id="ws-purpose"
          rows={2}
          value={content.purpose}
          onChange={(e) => onChange({ ...content, purpose: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="ws-instructions">Indicaciones para el estudiante</FieldLabel>
        <Textarea
          id="ws-instructions"
          rows={2}
          value={content.studentInstructions}
          onChange={(e) => onChange({ ...content, studentInstructions: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="ws-materials">Materiales</FieldLabel>
        <Textarea
          id="ws-materials"
          rows={2}
          defaultValue={content.materials.join("\n")}
          onBlur={(e) => onChange({ ...content, materials: lines(e.target.value) })}
        />
        <FieldDescription>Uno por línea.</FieldDescription>
      </Field>

      <p className="text-sm text-muted-foreground">
        Duración total de las actividades: {total} minutos (planeado:{" "}
        {resource.blueprint.durationMinutes}).
      </p>

      {content.moments.map((moment, mi) => (
        <section key={moment.name} className="flex flex-col gap-3" aria-labelledby={`moment-${mi}`}>
          <h3 id={`moment-${mi}`} className="font-medium">
            {mi + 1}. {moment.name}
          </h3>
          <ol className="flex flex-col gap-3" aria-label={`Actividades de ${moment.name}`}>
            {moment.activities.map((a) => {
              const label = `Actividad ${numbers.get(a.id)}`;
              return (
                <li key={a.id} className="flex flex-col gap-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Eliminar ${label}`}
                      onClick={() =>
                        setActivities(
                          mi,
                          moment.activities.filter((x) => x.id !== a.id),
                        )
                      }
                    >
                      <HiOutlineTrash aria-hidden />
                    </Button>
                  </div>
                  {editing === a.id ? (
                    <>
                      <ActivityForm
                        a={a}
                        onChange={(next) =>
                          setActivities(
                            mi,
                            moment.activities.map((x) => (x.id === a.id ? next : x)),
                          )
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-fit"
                        onClick={() => setEditing(null)}
                      >
                        Listo
                      </Button>
                    </>
                  ) : (
                    <ActivityView a={a} dba={dba} />
                  )}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {editing !== a.id && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing(a.id)}
                        >
                          <HiOutlinePencilSquare aria-hidden />
                          Editar
                        </Button>
                      )}
                      <RegenerateItem<Activity>
                        resourceId={resource.id}
                        itemKey={a.id}
                        label={label}
                        disabledReason={
                          dirty || !savedKeys.has(a.id)
                            ? "Guarda tus cambios antes de regenerar"
                            : null
                        }
                        renderProposal={(item) => <ActivityView a={item} dba={dba} />}
                        actions={actions}
                      />
                    </div>
                    {savedKeys.has(a.id) && (
                      <ItemFeedback
                        resourceId={resource.id}
                        courseId={resource.courseId}
                        itemKey={a.id}
                        label={label}
                        initial={resource.itemFeedback[a.id]}
                        actions={actions}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-fit"
            onClick={() => {
              const id = newId();
              setActivities(mi, [
                ...moment.activities,
                {
                  id,
                  title: "",
                  instructions: "",
                  durationMinutes: 10,
                  expectedOutcome: "",
                  cognitiveLevel: "APPLY",
                  dbaCodes: [],
                },
              ]);
              setEditing(id);
            }}
          >
            <HiOutlinePlus aria-hidden />
            Agregar actividad a {moment.name}
          </Button>
        </section>
      ))}

      {(content.sectionTexts ?? []).map((t, i) => (
        // SPEC-0010: secciones de texto del formato del docente, escritas por la IA.
        <Field key={t.title}>
          <FieldLabel htmlFor={`ws-section-${i}`}>{t.title}</FieldLabel>
          <Textarea
            id={`ws-section-${i}`}
            rows={5}
            value={t.content}
            onChange={(e) =>
              onChange({
                ...content,
                sectionTexts: (content.sectionTexts ?? []).map((x, j) =>
                  j === i ? { ...x, content: e.target.value } : x,
                ),
              })
            }
          />
        </Field>
      ))}

      <Field>
        <FieldLabel htmlFor="ws-guidance">Orientaciones para el docente</FieldLabel>
        <Textarea
          id="ws-guidance"
          rows={4}
          defaultValue={content.teacherGuidance.join("\n")}
          onBlur={(e) => onChange({ ...content, teacherGuidance: lines(e.target.value) })}
        />
        <FieldDescription>Una por línea.</FieldDescription>
      </Field>
    </div>
  );
}
