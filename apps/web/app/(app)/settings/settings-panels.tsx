"use client";

import { useState, type ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  HiOutlineCloudArrowDown,
  HiOutlineComputerDesktop,
  HiOutlineMoon,
  HiOutlineQuestionMarkCircle,
  HiOutlineSun,
  HiOutlineUserCircle,
} from "react-icons/hi2";
import { RiFontSize2 } from "react-icons/ri";
import { useLargeText } from "@/components/app-shell/text-size";
import { useShellStore } from "@/components/app-shell/use-shell-store";
import { OfflineSettings } from "@/components/offline/offline-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: IconType;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-softer text-brand">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-base font-bold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

type Space = { id: string; name: string; kind: string; roles: string; active: boolean };

/** Lo que el docente escribió al registrarse (solo lectura) y sus espacios. */
export function AccountCard(props: {
  name: string;
  email: string;
  since: string | null;
  spaces: Space[];
}) {
  return (
    <Section
      title="Mi cuenta"
      description="Los datos con los que te registraste."
      icon={HiOutlineUserCircle}
    >
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field label="Nombre" value={props.name} />
        <Field label="Correo" value={props.email} />
        {props.since && <Field label="Usas ProfIA desde" value={props.since} />}
      </dl>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-muted-foreground">
          {props.spaces.length === 1 ? "Tu espacio" : "Tus espacios"}
        </p>
        <ul className="flex flex-col gap-2">
          {props.spaces.map((space) => (
            <li
              key={space.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border px-4 py-3"
            >
              <span className="min-w-0 flex-1 basis-48 font-semibold break-words">
                {space.name}
              </span>
              <span className="text-sm text-muted-foreground">
                {space.kind} · {space.roles}
              </span>
              {space.active && (
                <span className="rounded-full bg-brand-softer px-2 py-0.5 text-[11px] font-bold text-brand-strong">
                  En uso
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-semibold break-words">{value}</dd>
    </div>
  );
}

type Option<T extends string> = { value: T; label: string; hint?: string; icon?: IconType };

/** Grupo de opciones con aspecto de tarjetas (radio accesible). */
function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "grid grid-cols-1 gap-2",
        options.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
      )}
    >
      {options.map((option) => {
        const checked = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
              checked
                ? "border-brand bg-brand-softer text-brand-strong"
                : "border-border hover:bg-muted",
            )}
          >
            {Icon && <Icon className="size-5 shrink-0" aria-hidden />}
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold">{option.label}</span>
              {option.hint && <span className="text-xs text-muted-foreground">{option.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

type TextSize = "normal" | "grande";
type Theme = "light" | "dark" | "system";

/** Tamaño de la letra (preferencia de este dispositivo) y modo de pantalla. */
export function DisplaySettings() {
  const [large, setLarge] = useLargeText();
  // Por ahora el modo solo se elige: claro/oscuro aún no cambia la pantalla.
  const [theme, setTheme] = useState<Theme>("light");

  return (
    <>
      <Section
        title="Tamaño de la letra"
        description="Se guarda en este dispositivo."
        icon={RiFontSize2}
      >
        <Choice<TextSize>
          label="Tamaño de la letra"
          value={large ? "grande" : "normal"}
          onChange={(v) => setLarge(v === "grande")}
          options={[
            { value: "normal", label: "Normal" },
            { value: "grande", label: "Más grande", hint: "Más fácil de leer" },
          ]}
        />
      </Section>
      <Section
        title="Modo de pantalla"
        description="El modo oscuro llegará pronto; por ahora ProfIA se ve en modo claro."
        icon={HiOutlineSun}
      >
        <Choice<Theme>
          label="Modo de pantalla"
          value={theme}
          onChange={setTheme}
          options={[
            { value: "light", label: "Claro", icon: HiOutlineSun },
            { value: "dark", label: "Oscuro", icon: HiOutlineMoon },
            { value: "system", label: "Como el dispositivo", icon: HiOutlineComputerDesktop },
          ]}
        />
      </Section>
    </>
  );
}

/** El tutorial salió de la tarjeta del menú y queda aquí. */
export function HelpCard() {
  const setTutorialOpen = useShellStore((s) => s.setTutorialOpen);
  return (
    <Section
      title="Ayuda"
      description="Vuelve a ver cómo funciona ProfIA."
      icon={HiOutlineQuestionMarkCircle}
    >
      <Button
        variant="outline"
        className="min-h-11 self-start"
        onClick={() => setTutorialOpen(true)}
      >
        Ver tutorial
      </Button>
    </Section>
  );
}

/** Guardar los recursos para usarlos sin internet (solo docentes: quien no da clases no tiene). */
export function OfflineCard() {
  return (
    <Section
      title="Usar sin conexión"
      description="Tus recursos en Word y PDF, listos aunque no haya internet. Si este dispositivo lo usan otras personas, mejor no."
      icon={HiOutlineCloudArrowDown}
    >
      <OfflineSettings />
    </Section>
  );
}
