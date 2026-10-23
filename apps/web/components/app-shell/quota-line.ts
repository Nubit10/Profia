// Línea de cupo de IA del menú (SPEC-0012 CA-0012-21). Pura: sin React, para poder probarla.

/** Cupo para mostrar, ya formateado en el servidor (hora de Colombia). */
export type QuotaView = { used: number; limit: number; freesAtLabel: string | null };

/** Texto y tono de la línea de cupo (CA-0012-21). */
export function quotaLine(quota: QuotaView) {
  const left = quota.limit - quota.used;
  if (left <= 0) {
    return {
      text: quota.freesAtLabel
        ? `Cupo de IA agotado · vuelve a las ${quota.freesAtLabel}`
        : "Cupo de IA agotado por hoy",
      short: `${quota.used}/${quota.limit} hoy`,
      tone: "text-danger",
      pill: "bg-danger-soft text-danger",
    };
  }
  return {
    text: `${quota.used} de ${quota.limit} recursos con IA hoy`,
    short: `${quota.used}/${quota.limit} hoy`,
    tone: left <= 2 ? "text-warning" : "text-brand-strong",
    pill: left <= 2 ? "bg-warning-soft text-warning" : "bg-brand-soft text-brand-strong",
  };
}
