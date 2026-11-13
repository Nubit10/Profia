-- CreateTable
CREATE TABLE "piars" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "tag" BYTEA NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "piars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "piars_institutionId_membershipId_idx" ON "piars"("institutionId", "membershipId");

-- CreateIndex
CREATE INDEX "piars_expiresAt_idx" ON "piars"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "piars_id_institutionId_key" ON "piars"("id", "institutionId");

-- AddForeignKey
ALTER TABLE "piars" ADD CONSTRAINT "piars_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piars" ADD CONSTRAINT "piars_membershipId_institutionId_fkey" FOREIGN KEY ("membershipId", "institutionId") REFERENCES "memberships"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piars" ADD CONSTRAINT "piars_courseId_institutionId_fkey" FOREIGN KEY ("courseId", "institutionId") REFERENCES "courses"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

