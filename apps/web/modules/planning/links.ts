import "server-only";
import type { Prisma } from "@/lib/db";
import { invalid } from "@/lib/errors";
import { getCourseReferences } from "@/modules/curriculum";
import type { TenantContext } from "@/modules/tenancy";

type LinkInput = { code: string; evidenceIndexes: number[] };

/**
 * RN-05: solo DBA publicados del área y grado del curso, con evidencias que les pertenezcan.
 * RN-06: un objetivo puede conservar los vínculos que ya tenía aunque su fuente fuera reemplazada.
 * Devuelve los vínculos listos para guardar (id del ítem + evidencias ordenadas sin repetir).
 */
export async function resolveLinks(
  tx: Prisma.TransactionClient,
  ctx: TenantContext,
  courseId: string,
  links: LinkInput[],
  keepCodes: string[] = [],
) {
  if (links.length === 0) return [];
  const codes = [...new Set(links.map((l) => l.code))];
  if (codes.length !== links.length) throw invalid("Hay un DBA repetido", "links");

  const { references } = await getCourseReferences(ctx, courseId);
  const allowed = new Set([...references.map((r) => r.code), ...keepCodes]);
  const items = await tx.curriculumItem.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true, evidences: true },
  });
  const byCode = new Map(items.map((i) => [i.code, i]));

  return links.map((link) => {
    const item = byCode.get(link.code);
    if (!item || !allowed.has(link.code)) {
      throw invalid("Ese DBA no corresponde al área y grado del curso", "links");
    }
    const indexes = [...new Set(link.evidenceIndexes)].sort((a, b) => a - b);
    if (indexes.some((i) => i >= item.evidences.length)) {
      throw invalid("Esa evidencia no pertenece al DBA elegido", "links");
    }
    return { curriculumItemId: item.id, evidenceIndexes: indexes };
  });
}
