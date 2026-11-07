-- AlterTable
ALTER TABLE "topics" ADD COLUMN     "dbaCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

