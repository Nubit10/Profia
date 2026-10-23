-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('WORKSHOP', 'QUIZ');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('GENERATING', 'FAILED', 'DRAFT', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResourceVersionSource" AS ENUM ('AI', 'TEACHER');

-- AlterTable
ALTER TABLE "generation_logs" ADD COLUMN     "tokens" INTEGER;

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "status" "ResourceStatus" NOT NULL DEFAULT 'GENERATING',
    "title" TEXT NOT NULL,
    "blueprint" JSONB NOT NULL,
    "context" JSONB NOT NULL,
    "failureReason" TEXT,
    "generationId" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "rating" INTEGER,
    "ratingComment" TEXT,
    "ratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_versions" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "source" "ResourceVersionSource" NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_item_feedback" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "rating" "SuggestionRating" NOT NULL,
    "comment" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_item_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_regenerations" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "generationId" TEXT,
    "proposal" JSONB,
    "decision" "SuggestionDecision" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "item_regenerations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_preferences" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "courseId" TEXT,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resources_institutionId_courseId_createdAt_idx" ON "resources"("institutionId", "courseId", "createdAt");

-- CreateIndex
CREATE INDEX "resources_membershipId_createdAt_idx" ON "resources"("membershipId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "resources_id_institutionId_key" ON "resources"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "resource_versions_resourceId_number_key" ON "resource_versions"("resourceId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "resource_item_feedback_resourceId_itemKey_key" ON "resource_item_feedback"("resourceId", "itemKey");

-- CreateIndex
CREATE INDEX "item_regenerations_resourceId_createdAt_idx" ON "item_regenerations"("resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "teacher_preferences_institutionId_membershipId_active_idx" ON "teacher_preferences"("institutionId", "membershipId", "active");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_membershipId_institutionId_fkey" FOREIGN KEY ("membershipId", "institutionId") REFERENCES "memberships"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_courseId_institutionId_fkey" FOREIGN KEY ("courseId", "institutionId") REFERENCES "courses"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_topicId_institutionId_fkey" FOREIGN KEY ("topicId", "institutionId") REFERENCES "topics"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_versions" ADD CONSTRAINT "resource_versions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_versions" ADD CONSTRAINT "resource_versions_resourceId_institutionId_fkey" FOREIGN KEY ("resourceId", "institutionId") REFERENCES "resources"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_item_feedback" ADD CONSTRAINT "resource_item_feedback_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_item_feedback" ADD CONSTRAINT "resource_item_feedback_resourceId_institutionId_fkey" FOREIGN KEY ("resourceId", "institutionId") REFERENCES "resources"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_regenerations" ADD CONSTRAINT "item_regenerations_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_regenerations" ADD CONSTRAINT "item_regenerations_resourceId_institutionId_fkey" FOREIGN KEY ("resourceId", "institutionId") REFERENCES "resources"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_preferences" ADD CONSTRAINT "teacher_preferences_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_preferences" ADD CONSTRAINT "teacher_preferences_membershipId_institutionId_fkey" FOREIGN KEY ("membershipId", "institutionId") REFERENCES "memberships"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

