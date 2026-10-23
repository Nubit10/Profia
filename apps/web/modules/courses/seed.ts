import "server-only";
import type { DbClient } from "@/lib/db";
import { normalizeName } from "@/lib/text";
import { PRELOADED_SUBJECTS } from "./catalog";

/** Precarga las asignaturas de la Ley 115 en un espacio nuevo (CA-0003-01). Idempotente. */
export async function seedPreloadedSubjects(client: DbClient, institutionId: string) {
  await client.subject.createMany({
    data: PRELOADED_SUBJECTS.map(({ name, area }) => ({
      institutionId,
      name,
      normalizedName: normalizeName(name),
      isPreloaded: true,
      curriculumAreaId: area,
    })),
    skipDuplicates: true,
  });
}
