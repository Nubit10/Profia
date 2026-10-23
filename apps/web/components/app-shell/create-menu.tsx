"use client";

import { useRouter } from "next/navigation";
import type { IconType } from "react-icons";
import {
  HiOutlineCalendarDays,
  HiOutlineClipboardDocumentCheck,
  HiOutlineClipboardDocumentList,
  HiOutlinePencilSquare,
  HiPlus,
} from "react-icons/hi2";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Option = {
  label: string;
  description: string;
  icon: IconType;
  href?: string;
};

// CA-0012-06 y SPEC-0011: Taller, Quiz, Examen y Planeación.
export const CREATE_OPTIONS: Option[] = [
  {
    label: "Taller",
    description: "Actividades de clase por momentos",
    icon: HiOutlinePencilSquare,
    href: "/create?type=WORKSHOP",
  },
  {
    label: "Quiz",
    description: "Preguntas cortas con su clave",
    icon: HiOutlineClipboardDocumentCheck,
    href: "/create?type=QUIZ",
  },
  {
    label: "Examen",
    description: "De unidad o de periodo, con puntaje",
    icon: HiOutlineClipboardDocumentList,
    href: "/create?type=EXAM",
  },
  {
    label: "Planeación",
    description: "Periodos, unidades y temas",
    icon: HiOutlineCalendarDays,
    href: "/create?type=PLAN",
  },
];

type Props = {
  onNavigate?: () => void;
  className?: string;
  /** Botón flotante redondo en el celular (SPEC-0012 §2.1). */
  floating?: boolean;
};

/** Botón "Crear": la acción primaria del área de trabajo (SPEC-0012 §2.1). */
export function CreateMenu({ onNavigate, className, floating = false }: Props) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "brand", size: floating ? "xl" : "lg" }),
          floating ? "rounded-full px-5" : "w-full",
          className,
        )}
      >
        <HiPlus className="size-5" aria-hidden />
        Crear
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={floating ? "end" : "start"}
        side={floating ? "top" : "bottom"}
        className="w-64"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>¿Qué quieres crear?</DropdownMenuLabel>
          {CREATE_OPTIONS.map(({ label, description, icon: Icon, href }) => (
            <DropdownMenuItem
              key={label}
              disabled={!href}
              onClick={() => {
                if (!href) return;
                onNavigate?.();
                router.push(href);
              }}
              className="items-start gap-3 py-2"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="flex flex-col">
                <span className="font-semibold">{label}</span>
                <span className="text-xs text-muted-foreground">{description}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
