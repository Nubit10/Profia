-- CreateEnum
CREATE TYPE "ResourceAdjustmentStatus" AS ENUM ('GENERATING', 'PROPOSED', 'ACCEPTED', 'DISCARDED', 'FAILED');

-- CreateTable
CREATE TABLE "resource_adjustments" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fromVersion" INTEGER NOT NULL,
    "status" "ResourceAdjustmentStatus" NOT NULL DEFAULT 'GENERATING',
    "failureReason" TEXT,
    "proposal" JSONB,
    "generationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "resource_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resource_adjustments_resourceId_createdAt_idx" ON "resource_adjustments"("resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "resource_adjustments_membershipId_createdAt_idx" ON "resource_adjustments"("membershipId", "createdAt");

-- AddForeignKey
ALTER TABLE "resource_adjustments" ADD CONSTRAINT "resource_adjustments_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_adjustments" ADD CONSTRAINT "resource_adjustments_resourceId_institutionId_fkey" FOREIGN KEY ("resourceId", "institutionId") REFERENCES "resources"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_adjustments" ADD CONSTRAINT "resource_adjustments_membershipId_institutionId_fkey" FOREIGN KEY ("membershipId", "institutionId") REFERENCES "memberships"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

