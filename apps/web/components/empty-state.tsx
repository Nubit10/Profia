import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { cn } from "@/lib/utils";

type Props = {
  icon: IconType;
  title: string;
  /** Una línea: qué es esto y por qué está vacío. */
  description: ReactNode;
  /** La acción concreta que resuelve el vacío (CA-0012-12). */
  action?: ReactNode;
  className?: string;
};

/** Estado vacío común: explicación de una línea y una acción concreta (SPEC-0012). */
export function EmptyState({ icon: Icon, title, description, action, className }: Props) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-brand-border bg-brand-softer px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong">
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="flex max-w-md flex-col gap-1">
        <h2 className="text-base font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
