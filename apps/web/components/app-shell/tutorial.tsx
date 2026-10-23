"use client";

import { useState } from "react";
import type { IconType } from "react-icons";
import {
  HiOutlineArrowDownTray,
  HiOutlineCalendarDays,
  HiOutlineSparkles,
  HiOutlineSquares2X2,
  HiXMark,
} from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Step = { icon: IconType; title: string; text: string };

// Tutorial de primer uso (SPEC-0012 §2.1): cuatro tarjetas, en el orden en que se trabaja.
const STEPS: Step[] = [
  {
    icon: HiOutlineSquares2X2,
    title: "1. Tus cursos",
    text: "Crea un curso por cada asignatura, grado y grupo que dictas. Todo lo demás vive dentro de él.",
  },
  {
    icon: HiOutlineCalendarDays,
    title: "2. Planea tus temas",
    text: "Organiza el año en periodos, unidades y temas. Profe te sugiere objetivos alineados con los DBA.",
  },
  {
    icon: HiOutlineSparkles,
    title: "3. Crea con IA y revisa",
    text: "Con el botón Crear haces un taller o un quiz en minutos. La IA propone; tú revisas, editas y decides.",
  },
  {
    icon: HiOutlineArrowDownTray,
    title: "4. Descarga en Word o PDF",
    text: "Lleva tu material a clase con el logo de tu colegio, la clave aparte y versiones para evitar la copia.",
  },
];

function StepsCarousel({ onFinish }: { onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index]!;
  const Icon = step.icon;
  const last = index === STEPS.length - 1;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lift">
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-1" aria-live="polite">
          <h3 className="text-base font-bold">{step.title}</h3>
          <p className="text-sm text-muted-foreground">{step.text}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5" aria-label={`Paso ${index + 1} de ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-6 bg-brand" : "w-1.5 bg-brand-border",
              )}
            />
          ))}
        </div>
        <div className="flex gap-2">
          {index > 0 && (
            <Button variant="ghost" onClick={() => setIndex(index - 1)}>
              Anterior
            </Button>
          )}
          <Button onClick={() => (last ? onFinish() : setIndex(index + 1))}>
            {last ? "Entendido" : "Siguiente"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Bienvenida en el Inicio la primera vez (CA-0012-26). No bloquea la pantalla. */
export function TutorialCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section
      aria-labelledby="tutorial-title"
      className="relative rounded-2xl border border-brand-border bg-brand-softer p-5 shadow-soft"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar el tutorial"
        className="absolute top-3 right-3 rounded-lg p-1.5 text-muted-foreground hover:bg-brand-soft hover:text-foreground"
      >
        <HiXMark className="size-5" aria-hidden />
      </button>
      <h2 id="tutorial-title" className="mb-4 pr-10 text-lg font-extrabold">
        Te damos la bienvenida a Profe
      </h2>
      <StepsCarousel onFinish={onDismiss} />
    </section>
  );
}

/** El mismo tutorial, abierto desde "Ver tutorial" en el menú. */
export function TutorialDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Así funciona Profe</DialogTitle>
          <DialogDescription>Cuatro pasos, en el orden en que trabajas.</DialogDescription>
        </DialogHeader>
        {open && <StepsCarousel onFinish={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
