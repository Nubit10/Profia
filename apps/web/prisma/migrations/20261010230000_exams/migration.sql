-- AlterEnum
ALTER TYPE "ResourceType" ADD VALUE 'EXAM';

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "gradingScale" JSONB;

-- CreateTable
CREATE TABLE "resource_topics" (
    "resourceId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "resource_topics_pkey" PRIMARY KEY ("resourceId","topicId")
);

-- CreateIndex
CREATE INDEX "resource_topics_institutionId_topicId_idx" ON "resource_topics"("institutionId", "topicId");

-- AddForeignKey
ALTER TABLE "resource_topics" ADD CONSTRAINT "resource_topics_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_topics" ADD CONSTRAINT "resource_topics_resourceId_institutionId_fkey" FOREIGN KEY ("resourceId", "institutionId") REFERENCES "resources"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_topics" ADD CONSTRAINT "resource_topics_topicId_institutionId_fkey" FOREIGN KEY ("topicId", "institutionId") REFERENCES "topics"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Datos existentes (SPEC-0011 T2): cada taller y quiz queda con su tema en la relación.
INSERT INTO "resource_topics" ("resourceId", "topicId", "institutionId", "position")
SELECT "id", "topicId", "institutionId", 0 FROM "resources"
ON CONFLICT DO NOTHING;
