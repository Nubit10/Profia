-- CreateTable
CREATE TABLE "course_periods" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE,
    "endDate" DATE,

    CONSTRAINT "course_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "periodNumber" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "plannedSessions" INTEGER,
    "position" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objectives" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objective_curriculum_links" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "curriculumItemId" TEXT NOT NULL,
    "evidenceIndexes" INTEGER[],

    CONSTRAINT "objective_curriculum_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_periods_courseId_number_key" ON "course_periods"("courseId", "number");

-- CreateIndex
CREATE INDEX "units_courseId_position_idx" ON "units"("courseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "units_id_institutionId_key" ON "units"("id", "institutionId");

-- CreateIndex
CREATE INDEX "topics_unitId_position_idx" ON "topics"("unitId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "topics_id_institutionId_key" ON "topics"("id", "institutionId");

-- CreateIndex
CREATE INDEX "objectives_topicId_position_idx" ON "objectives"("topicId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "objectives_id_institutionId_key" ON "objectives"("id", "institutionId");

-- CreateIndex
CREATE INDEX "objective_curriculum_links_institutionId_curriculumItemId_idx" ON "objective_curriculum_links"("institutionId", "curriculumItemId");

-- CreateIndex
CREATE UNIQUE INDEX "objective_curriculum_links_objectiveId_curriculumItemId_key" ON "objective_curriculum_links"("objectiveId", "curriculumItemId");

-- CreateIndex
CREATE UNIQUE INDEX "courses_id_institutionId_key" ON "courses"("id", "institutionId");

-- AddForeignKey
ALTER TABLE "course_periods" ADD CONSTRAINT "course_periods_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_periods" ADD CONSTRAINT "course_periods_courseId_institutionId_fkey" FOREIGN KEY ("courseId", "institutionId") REFERENCES "courses"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_courseId_institutionId_fkey" FOREIGN KEY ("courseId", "institutionId") REFERENCES "courses"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_unitId_institutionId_fkey" FOREIGN KEY ("unitId", "institutionId") REFERENCES "units"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_topicId_institutionId_fkey" FOREIGN KEY ("topicId", "institutionId") REFERENCES "topics"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objective_curriculum_links" ADD CONSTRAINT "objective_curriculum_links_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objective_curriculum_links" ADD CONSTRAINT "objective_curriculum_links_objectiveId_institutionId_fkey" FOREIGN KEY ("objectiveId", "institutionId") REFERENCES "objectives"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objective_curriculum_links" ADD CONSTRAINT "objective_curriculum_links_curriculumItemId_fkey" FOREIGN KEY ("curriculumItemId") REFERENCES "curriculum_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

