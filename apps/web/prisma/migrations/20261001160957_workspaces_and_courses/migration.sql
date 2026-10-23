-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('INDEPENDENT', 'SCHOOL');

-- CreateEnum
CREATE TYPE "Sector" AS ENUM ('OFICIAL', 'PRIVADO');

-- CreateEnum
CREATE TYPE "SchoolCalendar" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEACHER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('JARDIN', 'TRANSICION', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11');

-- CreateTable
CREATE TABLE "institutions" (
    "id" TEXT NOT NULL,
    "type" "InstitutionType" NOT NULL,
    "name" TEXT NOT NULL,
    "sector" "Sector",
    "daneCode" TEXT,
    "nit" TEXT,
    "department" TEXT,
    "municipality" TEXT,
    "calendar" "SchoolCalendar",
    "independentOwnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campuses" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roles" "Role"[],
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roles" "Role"[],
    "tokenHash" TEXT NOT NULL,
    "invitedByMembershipId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "isPreloaded" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "grade" "Grade" NOT NULL,
    "groupName" TEXT NOT NULL DEFAULT '',
    "academicYear" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "institutions_independentOwnerId_key" ON "institutions"("independentOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "campuses_id_institutionId_key" ON "campuses"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "campuses_institutionId_normalizedName_key" ON "campuses"("institutionId", "normalizedName");

-- CreateIndex
CREATE INDEX "memberships_userId_idx" ON "memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_institutionId_userId_key" ON "memberships"("institutionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_id_institutionId_key" ON "memberships"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "invitations_institutionId_email_idx" ON "invitations"("institutionId", "email");

-- CreateIndex
CREATE INDEX "audit_logs_institutionId_createdAt_idx" ON "audit_logs"("institutionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_id_institutionId_key" ON "subjects"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_institutionId_normalizedName_key" ON "subjects"("institutionId", "normalizedName");

-- CreateIndex
CREATE INDEX "courses_institutionId_membershipId_idx" ON "courses"("institutionId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "courses_membershipId_subjectId_grade_groupName_academicYear_key" ON "courses"("membershipId", "subjectId", "grade", "groupName", "academicYear");

-- AddForeignKey
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_independentOwnerId_fkey" FOREIGN KEY ("independentOwnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campuses" ADD CONSTRAINT "campuses_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedByMembershipId_institutionId_fkey" FOREIGN KEY ("invitedByMembershipId", "institutionId") REFERENCES "memberships"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_membershipId_institutionId_fkey" FOREIGN KEY ("membershipId", "institutionId") REFERENCES "memberships"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_subjectId_institutionId_fkey" FOREIGN KEY ("subjectId", "institutionId") REFERENCES "subjects"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_campusId_institutionId_fkey" FOREIGN KEY ("campusId", "institutionId") REFERENCES "campuses"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;
