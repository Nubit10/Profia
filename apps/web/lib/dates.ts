// Fechas que se muestran en componentes que también renderiza el servidor. Node y el navegador
// traen versiones distintas de ICU: uno escribe "p. m." con espacio normal y otro con espacio
// duro (U+00A0 o U+202F). Esa diferencia rompe la hidratación de React, así que se normaliza, y
// la zona horaria es fija para que el servidor y el equipo del docente den la misma hora.

const TIME_ZONE = "America/Bogota";

const dateTime = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

const dayMonth = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  timeZone: TIME_ZONE,
});

const plainSpaces = (value: string) => value.replace(/[  ]/g, " ");

/** "4 de nov, 10:53 p. m." */
export function formatDateTime(value: Date | string): string {
  return plainSpaces(dateTime.format(new Date(value)));
}

/** "4 de noviembre" */
export function formatDayMonth(value: Date | string): string {
  return plainSpaces(dayMonth.format(new Date(value)));
}
