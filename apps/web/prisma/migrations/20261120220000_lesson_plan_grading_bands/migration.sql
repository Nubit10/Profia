-- AlterEnum
ALTER TYPE "ResourceType" ADD VALUE 'LESSON_PLAN';

-- AlterTable
ALTER TABLE "institutions" ADD COLUMN     "gradingBands" JSONB;

