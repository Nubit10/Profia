"use client";

import { useState } from "react";
import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import {
  PREFERENCE_SCOPES,
  PREFERENCE_SCOPE_LABELS,
  type PreferenceScope,
  type TeacherPreferenceView,
} from "@/modules/resources/client";
import { useRun } from "../planning/use-run";

export type PreferenceActions = {
  add: (input: {
    courseId: string;
    text: string;
    scope: PreferenceScope;
  }) => Promise<ActionResult<{ id: string }>>;
  update: (input: {
    preferenceId: string;
    active?: boolean;
    scope?: PreferenceScope;
    courseId?: string;
  }) => Promise<ActionResult>;
  remove: (input: { preferenceId: string }) => Promise<ActionResult>;
};

const SCOPE_OPTIONS = PREFERENCE_SCOPES.map((s) => ({
  value: s,
  label: PREFERENCE_SCOPE_LABELS[s],
}));

type Props = {
  courseId: string;
  preferences: TeacherPreferenceView[];
  excluded: string[];
  onExcludedChange: (ids: string[]) => void;
  actions: PreferenceActions;
};

/** RN-07: indicaciones guardadas que la IA tiene en cuenta; el docente decide su alcance. */
export function PreferencesPanel({
  courseId,
  preferences,
  excluded,
  onExcludedChange,
  actions,
}: Props) {
  const { run, isPending } = useRun();
  const [text, setText] = useState("");
  const [scope, setScope] = useState<PreferenceScope>("COURSE");

  return (
    <FieldSet>
      <FieldLegend>Mis preferencias para la IA</FieldLegend>
      <FieldDescription>
        Indicaciones que guardaste al evaluar recursos. Se usan en cada generación (máximo 5).
      </FieldDescription>
      {preferences.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Preferencias guardadas">
          {preferences.map((p) => {
            const id = `pref-${p.id}`;
            return (
              <li
                key={p.id}
                className="flex flex-col gap-2 rounded-lg border p-2.5 sm:flex-row sm:items-center"
              >
                <div className="flex flex-1 items-start gap-2">
                  <Checkbox
                    id={id}
                    aria-labelledby={`${id}-label`}
                    checked={p.active && !excluded.includes(p.id)}
                    disabled={!p.active}
                    onCheckedChange={(c) =>
                      onExcludedChange(c ? excluded.filter((x) => x !== p.id) : [...excluded, p.id])
                    }
                    className="mt-0.5"
                  />
                  <label
                    id={`${id}-label`}
                    htmlFor={id}
                    className={p.active ? "text-sm" : "text-sm text-muted-foreground line-through"}
                  >
                    {p.text}
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-40">
                    <SelectField
                      id={`${id}-scope`}
                      value={p.scope}
                      disabled={isPending}
                      onChange={(v) =>
                        run(() =>
                          actions.update({
                            preferenceId: p.id,
                            scope: v as PreferenceScope,
                            courseId,
                          }),
                        )
                      }
                      options={SCOPE_OPTIONS}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() =>
                      run(() => actions.update({ preferenceId: p.id, active: !p.active }))
                    }
                  >
                    {p.active ? "Desactivar" : "Activar"}
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Eliminar preferencia: ${p.text}`}
                    disabled={isPending}
                    onClick={() =>
                      run(() => actions.remove({ preferenceId: p.id }), "Preferencia eliminada")
                    }
                  >
                    <HiOutlineTrash aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Nueva preferencia"
          placeholder="Ej.: usa ejemplos con dinero colombiano"
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="w-full sm:w-44">
          <SelectField
            id="new-pref-scope"
            value={scope}
            onChange={(v) => setScope(v as PreferenceScope)}
            options={SCOPE_OPTIONS}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isPending || text.trim().length < 5}
          onClick={() =>
            run(
              () => actions.add({ courseId, text, scope }),
              "Preferencia guardada",
              () => setText(""),
            )
          }
        >
          <HiOutlinePlus aria-hidden />
          Agregar
        </Button>
      </div>
    </FieldSet>
  );
}
