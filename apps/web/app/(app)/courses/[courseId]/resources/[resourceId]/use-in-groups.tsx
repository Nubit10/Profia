"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { HiOutlineUserGroup } from "react-icons/hi2";
import { sileo } from "sileo";
import { SelectableOption } from "@/components/forms/selectable";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/action-result";

export type UseInGroupsActions = {
  copyTargets: (input: {
    resourceId: string;
  }) => Promise<ActionResult<{ id: string; label: string }[]>>;
  copyToCourses: (input: {
    resourceId: string;
    courseIds: string[];
  }) => Promise<ActionResult<{ courseId: string; resourceId: string; createdTopic: boolean }[]>>;
};

/**
 * SPEC-0028: el mismo recurso en los otros grupos de la misma asignatura y grado, con un toque y
 * sin gastar cupo de IA. Todos los grupos vienen marcados.
 */
export function UseInGroups({
  resourceId,
  open,
  onOpenChange,
  actions,
}: {
  resourceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: UseInGroupsActions;
}) {
  const [targets, setTargets] = useState<{ id: string; label: string }[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<{ label: string; href: string }[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void actions.copyTargets({ resourceId }).then((result) => {
      if (!alive) return;
      const list = result.ok ? result.data! : [];
      setTargets(list);
      setChosen(new Set(list.map((t) => t.id)));
      setDone(null);
    });
    return () => {
      alive = false;
    };
  }, [actions, open, resourceId]);

  const copy = () =>
    startTransition(async () => {
      const result = await actions.copyToCourses({ resourceId, courseIds: [...chosen] });
      if (!result.ok) {
        sileo.error({ title: "No pudimos copiarlo", description: result.error });
        return;
      }
      const copies = result.data!.map((c) => ({
        label: targets!.find((t) => t.id === c.courseId)?.label ?? "Curso",
        href: `/courses/${c.courseId}/resources/${c.resourceId}`,
      }));
      setDone(copies);
      sileo.success({
        title: copies.length === 1 ? "Listo en 1 grupo" : `Listo en ${copies.length} grupos`,
        description: "No gastó de tu cupo de IA.",
      });
    });

  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Usar también en…</DialogTitle>
          <DialogDescription>
            Una copia para cada grupo, en el mismo tema. No gasta de tu cupo de IA.
          </DialogDescription>
        </DialogHeader>
        {targets === null ? (
          <p className="text-sm text-muted-foreground" role="status">
            Buscando tus grupos…
          </p>
        ) : done ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">Ya está en:</p>
            <ul className="flex flex-col gap-1">
              {done.map((d) => (
                <li key={d.href}>
                  <Link
                    href={d.href}
                    className="flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline"
                    onClick={() => onOpenChange(false)}
                  >
                    {d.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        ) : targets.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              No tienes otros grupos de esta asignatura y grado. Crea el curso (por ejemplo, 602) y
              vuelve aquí.
            </p>
            <Link href="/courses" className={buttonVariants({ variant: "outline" })}>
              Ir a Mis cursos
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2" role="group" aria-label="Grupos">
              {targets.map((t) => (
                <SelectableOption
                  key={t.id}
                  checked={chosen.has(t.id)}
                  onCheckedChange={() => toggle(t.id)}
                >
                  {t.label}
                </SelectableOption>
              ))}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button disabled={isPending || chosen.size === 0} onClick={copy}>
                <HiOutlineUserGroup aria-hidden />
                {isPending
                  ? "Copiando…"
                  : chosen.size === 1
                    ? "Usar en 1 grupo"
                    : `Usar en ${chosen.size} grupos`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
