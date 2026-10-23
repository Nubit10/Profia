"use client";

import { useState } from "react";
import { HiChevronDown, HiOutlineArrowDownTray, HiOutlineDocumentText } from "react-icons/hi2";
import { SelectField } from "@/components/forms/select-field";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { VARIANTS } from "@/modules/documents/client";
import type { ResourceType } from "@/modules/resources/client";

type Props = {
  courseId: string;
  resourceId: string;
  type: ResourceType;
  version: number;
  /** SPEC-0011 RN-15: el examen tiene hoja de respuestas si trae selección múltiple o V/F. */
  answerSheet?: boolean;
};

type Doc = "student" | "key" | "answers";

/**
 * SPEC-0009: descargas en Word y PDF; quiz y examen pueden salir en varias versiones (RN-07).
 * SPEC-0012: agrupadas en un solo botón "Descargar" con opciones.
 */
export function Downloads({ courseId, resourceId, type, version, answerSheet = false }: Props) {
  const [count, setCount] = useState(1);
  const href = (doc: Doc, format: "pdf" | "docx", variant = "A") =>
    `/courses/${courseId}/resources/${resourceId}/export?doc=${doc}&format=${format}&version=${version}&variant=${variant}`;
  const [studentLabel, keyLabel] =
    type === "WORKSHOP"
      ? ["Guía del estudiante", "Guía del docente"]
      : ["Hoja del estudiante", "Clave"];
  const withVariants = type !== "WORKSHOP";
  const variants = withVariants ? VARIANTS.slice(0, count) : (["A"] as const);
  const suffix = (v: string) => (variants.length > 1 ? ` (versión ${v})` : "");

  const item = (label: string, format: "PDF" | "Word", name: string, url: string) => (
    <DropdownMenuItem
      key={name}
      aria-label={name}
      render={<a href={url} download />}
      className="gap-2"
    >
      <HiOutlineDocumentText aria-hidden />
      <span className="flex-1">{label}</span>
      <span className="text-xs font-semibold text-muted-foreground">{format}</span>
    </DropdownMenuItem>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {withVariants && (
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="variants" className="text-muted-foreground">
            Versiones para evitar la copia
          </label>
          <div className="w-20">
            <SelectField
              id="variants"
              value={String(count)}
              onChange={(v) => setCount(Number(v))}
              options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
            />
          </div>
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(buttonVariants({ size: "lg" }))}>
          <HiOutlineArrowDownTray aria-hidden />
          Descargar
          <HiChevronDown aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {variants.map((v, index) => (
            <DropdownMenuGroup key={v}>
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>
                {variants.length > 1 ? `Versión ${v}` : `Última versión guardada (${version})`}
              </DropdownMenuLabel>
              {item(
                studentLabel,
                "PDF",
                `${studentLabel}${suffix(v)} en PDF`,
                href("student", "pdf", v),
              )}
              {item(
                studentLabel,
                "Word",
                `${studentLabel}${suffix(v)} en Word`,
                href("student", "docx", v),
              )}
              {item(keyLabel, "PDF", `${keyLabel}${suffix(v)} en PDF`, href("key", "pdf", v))}
              {item(keyLabel, "Word", `${keyLabel}${suffix(v)} en Word`, href("key", "docx", v))}
            </DropdownMenuGroup>
          ))}
          {/* RN-15: la hoja de respuestas es la misma para todas las versiones. */}
          {answerSheet && (
            <DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Para todas las versiones</DropdownMenuLabel>
              {item(
                "Hoja de respuestas",
                "PDF",
                "Hoja de respuestas en PDF",
                href("answers", "pdf"),
              )}
              {item(
                "Hoja de respuestas",
                "Word",
                "Hoja de respuestas en Word",
                href("answers", "docx"),
              )}
            </DropdownMenuGroup>
          )}
          {withVariants && count > 1 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {type === "EXAM"
                ? "Cada versión cambia el orden de las preguntas dentro de cada sección y el de las opciones, y tiene su propia clave."
                : "Cada versión cambia el orden de las preguntas y de las opciones, y tiene su propia clave."}
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
