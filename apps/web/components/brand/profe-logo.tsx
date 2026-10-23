import { HiOutlineAcademicCap } from "react-icons/hi2";
import { cn } from "@/lib/utils";

/** Logotipo provisional de Profe (decisión 2 de SPEC-0012): icono con el degradado + nombre. */
export function ProfeMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-lift",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <HiOutlineAcademicCap style={{ width: size * 0.58, height: size * 0.58 }} />
    </span>
  );
}

export function ProfeLogo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <ProfeMark size={size} />
      <span className="text-xl font-extrabold tracking-tight text-foreground">Profe</span>
    </span>
  );
}
