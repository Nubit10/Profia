// Reparto determinista de los DBA del curso entre sus periodos (SPEC-0014 RN-04, ADR-0013).
// Función pura: la usan el servidor para armar la propuesta y las pruebas.

/**
 * Divide los códigos (ya ordenados por número de DBA) en bloques seguidos, uno por periodo, del
 * tamaño más parejo posible. Los primeros periodos reciben uno más cuando no da exacto.
 */
export function splitDbaByPeriod(codes: string[], periodNumbers: number[]) {
  const result = new Map<number, string[]>();
  const n = periodNumbers.length;
  if (n === 0) return result;
  const base = Math.floor(codes.length / n);
  const extra = codes.length % n;
  let start = 0;
  periodNumbers.forEach((number, i) => {
    const size = base + (i < extra ? 1 : 0);
    result.set(number, codes.slice(start, start + size));
    start += size;
  });
  return result;
}
