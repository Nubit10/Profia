-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('OK', 'INVALID', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "SuggestionDecision" AS ENUM ('PENDING', 'ACCEPTED', 'EDITED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "SuggestionRating" AS ENUM ('UP', 'DOWN');

-- CreateTable
CREATE TABLE "generation_logs" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" "GenerationStatus" NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "promptVersion" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_suggestions" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "statement" TEXT NOT NULL,
    "dbaCodes" TEXT[],
    "decision" "SuggestionDecision" NOT NULL DEFAULT 'PENDING',
    "finalStatement" TEXT,
    "objectiveId" TEXT,
    "rating" "SuggestionRating",
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "generation_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generation_logs_institutionId_membershipId_createdAt_idx" ON "generation_logs"("institutionId", "membershipId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "generation_logs_id_institutionId_key" ON "generation_logs"("id", "institutionId");

-- CreateIndex
CREATE INDEX "generation_suggestions_generationId_idx" ON "generation_suggestions"("generationId");

-- AddForeignKey
ALTER TABLE "generation_logs" ADD CONSTRAINT "generation_logs_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_suggestions" ADD CONSTRAINT "generation_suggestions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_suggestions" ADD CONSTRAINT "generation_suggestions_generationId_institutionId_fkey" FOREIGN KEY ("generationId", "institutionId") REFERENCES "generation_logs"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

