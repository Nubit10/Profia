import type { CurriculumReference } from "./types";

export type CurriculumSearchResult =
  { status: "ok"; references: CurriculumReference[] } | { status: "unavailable" };
