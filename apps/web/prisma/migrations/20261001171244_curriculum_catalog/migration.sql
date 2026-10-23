-- CreateEnum
CREATE TYPE "CurriculumDocumentType" AS ENUM ('DBA', 'STANDARD');

-- CreateEnum
CREATE TYPE "CurriculumSourceStatus" AS ENUM ('PUBLISHED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "CurriculumReviewStatus" AS ENUM ('PENDING', 'APPROVED');

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "curriculumAreaId" TEXT;

-- CreateTable
CREATE TABLE "curriculum_areas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "curriculum_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_sources" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "documentKey" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" "CurriculumDocumentType" NOT NULL,
    "areaId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "isbn" TEXT,
    "url" TEXT NOT NULL,
    "landingUrl" TEXT,
    "sha256" TEXT NOT NULL,
    "usageNote" TEXT NOT NULL,
    "status" "CurriculumSourceStatus" NOT NULL DEFAULT 'PUBLISHED',
    "reviewStatus" "CurriculumReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curriculum_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_items" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CurriculumDocumentType" NOT NULL,
    "areaId" TEXT NOT NULL,
    "grade" "Grade",
    "gradeFrom" "Grade",
    "gradeTo" "Grade",
    "number" INTEGER NOT NULL,
    "component" TEXT,
    "statement" TEXT NOT NULL,
    "evidences" TEXT[],
    "page" INTEGER NOT NULL,

    CONSTRAINT "curriculum_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_sources_key_key" ON "curriculum_sources"("key");

-- CreateIndex
CREATE INDEX "curriculum_sources_documentKey_idx" ON "curriculum_sources"("documentKey");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_items_code_key" ON "curriculum_items"("code");

-- CreateIndex
CREATE INDEX "curriculum_items_areaId_grade_idx" ON "curriculum_items"("areaId", "grade");

-- CreateIndex
CREATE INDEX "curriculum_items_grade_idx" ON "curriculum_items"("grade");

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_curriculumAreaId_fkey" FOREIGN KEY ("curriculumAreaId") REFERENCES "curriculum_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_sources" ADD CONSTRAINT "curriculum_sources_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "curriculum_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_items" ADD CONSTRAINT "curriculum_items_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "curriculum_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_items" ADD CONSTRAINT "curriculum_items_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "curriculum_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Datos de referencia (SPEC-0004): áreas curriculares oficiales.
INSERT INTO "curriculum_areas" ("id", "name", "sortOrder") VALUES
  ('MATEMATICAS', 'Matemáticas', 1),
  ('LENGUAJE', 'Lenguaje', 2),
  ('CIENCIAS_NATURALES', 'Ciencias Naturales', 3),
  ('CIENCIAS_SOCIALES', 'Ciencias Sociales', 4),
  ('INGLES', 'Inglés', 5),
  ('TRANSICION', 'Transición (todas las dimensiones)', 6);

-- Vínculo de las asignaturas precargadas que ya existen (CA-0004-05).
UPDATE "subjects" SET "curriculumAreaId" = 'MATEMATICAS' WHERE "isPreloaded" AND "normalizedName" = 'matematicas';
UPDATE "subjects" SET "curriculumAreaId" = 'LENGUAJE' WHERE "isPreloaded" AND "normalizedName" = 'lengua castellana';
UPDATE "subjects" SET "curriculumAreaId" = 'CIENCIAS_NATURALES' WHERE "isPreloaded" AND "normalizedName" = 'ciencias naturales y educacion ambiental';
UPDATE "subjects" SET "curriculumAreaId" = 'CIENCIAS_SOCIALES' WHERE "isPreloaded" AND "normalizedName" = 'ciencias sociales';
UPDATE "subjects" SET "curriculumAreaId" = 'INGLES' WHERE "isPreloaded" AND "normalizedName" = 'ingles';
