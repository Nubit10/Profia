import { HiOutlineCheckBadge, HiOutlineExclamationTriangle } from "react-icons/hi2";
import type { AnswerCheck } from "@/modules/resources/client";
import { cn } from "@/lib/utils";

const LABELS: Record<AnswerCheck["status"], string> = {
  VERIFIED: "Respuesta verificada",
  CORRECTED: "Respuesta corregida según el cálculo",
  REVIEW: "Revisa esta respuesta",
};

/**
 * SPEC-0022 RN-08: estado de la verificación de una respuesta de Matemáticas. Solo en el editor;
 * los Word y PDF no la llevan.
 */
export function AnswerCheckBadge({ check }: { check?: AnswerCheck }) {
  if (!check) return null;
  const ok = check.status === "VERIFIED";
  const Icon = ok ? HiOutlineCheckBadge : HiOutlineExclamationTriangle;
  return (
    <p
      data-testid="answer-check"
      data-status={check.status}
      className={cn(
        "flex w-fit items-start gap-1.5 rounded-lg px-2 py-1 text-xs",
        ok ? "bg-success-soft text-success" : "bg-warning-soft text-foreground",
      )}
    >
      <Icon className="mt-px size-4 shrink-0" aria-hidden />
      <span>
        <span className="font-semibold">{LABELS[check.status]}</span>
        {check.note && <span>{ok ? ` · ${check.note}` : `: ${check.note}`}</span>}
      </span>
    </p>
  );
}
