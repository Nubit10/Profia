import Link from "next/link";
import type { ReactNode } from "react";
import { HiOutlineArrowLeft } from "react-icons/hi2";

type Props = {
  title: ReactNode;
  /** Línea pequeña sobre el título (p. ej. el espacio o el curso). */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Acciones a la derecha del título. */
  actions?: ReactNode;
  back?: { href: string; label: string };
};

/** Encabezado común de las páginas del área de trabajo (SPEC-0012). */
export function PageHeader({ title, eyebrow, description, actions, back }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {back && (
        <Link
          href={back.href}
          className="flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <HiOutlineArrowLeft aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          {eyebrow && <p className="text-sm font-medium text-brand-strong">{eyebrow}</p>}
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          {description && <p className="max-w-2xl text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
