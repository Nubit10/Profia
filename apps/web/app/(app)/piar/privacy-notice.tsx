import { HiOutlineLockClosed } from "react-icons/hi2";
import { PIAR_PRIVACY_NOTE } from "@/modules/piar/client";

const dateFormat = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
});

/**
 * SPEC-0017 RN-06: el aviso de privacidad va en cada pantalla del PIAR, siempre visible (no se
 * puede cerrar). Con `expiresAt`, dice cuándo se borra solo.
 */
export function PrivacyNotice({ expiresAt }: { expiresAt?: Date }) {
  return (
    <aside
      role="note"
      aria-label="Aviso de privacidad"
      data-testid="piar-privacy"
      className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-sm"
    >
      <HiOutlineLockClosed className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="font-bold">{PIAR_PRIVACY_NOTE}</p>
        <p>
          No incluyas diagnósticos ni datos de contacto. No compartas esta pantalla ni sus capturas.
          {expiresAt
            ? ` Este PIAR se borra solo el ${dateFormat.format(new Date(expiresAt.getTime() - 1))}.`
            : " Cada PIAR se borra solo al terminar el año siguiente a su año lectivo."}
        </p>
      </div>
    </aside>
  );
}
