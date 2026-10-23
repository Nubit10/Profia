"use server";

import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { requireTenant } from "@/modules/tenancy";
import { searchCourseCurriculum } from "./search";
import type { CurriculumSearchResult } from "./search-types";

const searchSchema = z.object({
  courseId: z.string().min(1),
  query: z.string().trim().min(3, "Escribe al menos 3 caracteres").max(300),
});

export async function searchCurriculumAction(
  input: unknown,
): Promise<ActionResult<CurriculumSearchResult>> {
  return runAction("search_curriculum", searchSchema, input, async ({ courseId, query }) =>
    searchCourseCurriculum(await requireTenant(), courseId, query),
  );
}
