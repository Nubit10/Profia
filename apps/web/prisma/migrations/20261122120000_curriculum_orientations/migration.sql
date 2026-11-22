-- SPEC-0038 etapa 2 (ADR-0022): orientaciones pedagógicas del MEN como referentes del catálogo.
ALTER TYPE "CurriculumDocumentType" ADD VALUE IF NOT EXISTS 'ORIENTATION';

INSERT INTO "curriculum_areas" ("id", "name", "sortOrder") VALUES
  ('TECNOLOGIA', 'Tecnología e Informática', 8),
  ('EDUCACION_FISICA', 'Educación Física', 9),
  ('ARTISTICA', 'Educación Artística', 10),
  ('FILOSOFIA', 'Filosofía', 11)
ON CONFLICT ("id") DO NOTHING;

-- Las asignaturas precargadas que siguen sin área se vinculan solas; si el docente eligió otra, se respeta.
UPDATE "subjects" SET "curriculumAreaId" = CASE "normalizedName"
    WHEN 'tecnologia e informatica' THEN 'TECNOLOGIA'
    WHEN 'educacion fisica, recreacion y deportes' THEN 'EDUCACION_FISICA'
    WHEN 'educacion artistica' THEN 'ARTISTICA'
    WHEN 'filosofia' THEN 'FILOSOFIA'
  END
WHERE "isPreloaded" AND "curriculumAreaId" IS NULL
  AND "normalizedName" IN ('tecnologia e informatica', 'educacion fisica, recreacion y deportes', 'educacion artistica', 'filosofia');
