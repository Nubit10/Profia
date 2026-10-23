-- CreateEnum
CREATE TYPE "FormatScope" AS ENUM ('TEACHER', 'INSTITUTION');

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "formatSnapshot" JSONB;

-- CreateTable
CREATE TABLE "document_formats" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "scope" "FormatScope" NOT NULL,
    "membershipId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "structure" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_formats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_logos" (
    "institutionId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_logos_pkey" PRIMARY KEY ("institutionId")
);

-- CreateIndex
CREATE INDEX "document_formats_institutionId_scope_idx" ON "document_formats"("institutionId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "document_formats_id_institutionId_key" ON "document_formats"("id", "institutionId");

-- AddForeignKey
ALTER TABLE "document_formats" ADD CONSTRAINT "document_formats_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_formats" ADD CONSTRAINT "document_formats_membershipId_institutionId_fkey" FOREIGN KEY ("membershipId", "institutionId") REFERENCES "memberships"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_logos" ADD CONSTRAINT "institution_logos_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

