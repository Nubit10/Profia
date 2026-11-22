-- SPEC-0038: área de Competencias Ciudadanas (Estándares Básicos de Competencias Ciudadanas, MEN 2006).
INSERT INTO "curriculum_areas" ("id", "name", "sortOrder") VALUES
  ('CIUDADANAS', 'Competencias Ciudadanas', 7)
ON CONFLICT ("id") DO NOTHING;

-- Ética y Valores Humanos y Cátedra de la Paz se vinculan solas (RN-02 de SPEC-0038). Solo las
-- precargadas que siguen sin área: si el docente eligió otra, se respeta.
UPDATE "subjects" SET "curriculumAreaId" = 'CIUDADANAS'
WHERE "isPreloaded" AND "curriculumAreaId" IS NULL
  AND "normalizedName" IN ('etica y valores humanos', 'catedra de la paz');

-- Cátedra de la Paz (Ley 1732 de 2014) queda precargada también en los espacios que ya existen.
INSERT INTO "subjects" ("id", "institutionId", "name", "normalizedName", "isPreloaded", "curriculumAreaId", "updatedAt")
SELECT gen_random_uuid()::text, i."id", 'Cátedra de la Paz', 'catedra de la paz', true, 'CIUDADANAS', now()
FROM "institutions" i
ON CONFLICT ("institutionId", "normalizedName") DO NOTHING;
