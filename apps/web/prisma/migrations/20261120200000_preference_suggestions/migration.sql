-- CreateEnum
CREATE TYPE "PreferenceSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "generation_logs" ADD COLUMN     "qualityRulesVersion" TEXT,
ADD COLUMN     "qualityWarnings" INTEGER;

-- CreateTable
CREATE TABLE "preference_suggestions" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "courseId" TEXT,
    "text" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "conflictsWithId" TEXT,
    "status" "PreferenceSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "generationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "preference_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "preference_suggestions_institutionId_membershipId_createdAt_idx" ON "preference_suggestions"("institutionId", "membershipId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "preference_suggestions_id_institutionId_key" ON "preference_suggestions"("id", "institutionId");

-- AddForeignKey
ALTER TABLE "preference_suggestions" ADD CONSTRAINT "preference_suggestions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preference_suggestions" ADD CONSTRAINT "preference_suggestions_membershipId_institutionId_fkey" FOREIGN KEY ("membershipId", "institutionId") REFERENCES "memberships"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

