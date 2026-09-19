-- Phase 9 — Khảo sát có tổ chức (VII. Quản lý khảo sát thực địa)
-- Thêm 3 bảng: survey_campaign (đợt) → survey_zone (phân vùng theo Xã/
-- Phường) → survey_assignment (giao SURVEYOR), cùng cột House.surveyAssignmentId
-- (tùy chọn, không bắt buộc — xem ghi chú prisma/schema.prisma).

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'NEEDS_REVISIT');


-- AlterTable
ALTER TABLE "house" ADD COLUMN     "surveyAssignmentId" TEXT;

-- CreateTable
CREATE TABLE "survey_campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_zone" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wardId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_assignment" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "note" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "survey_campaign_status_idx" ON "survey_campaign"("status");

-- CreateIndex
CREATE INDEX "survey_zone_campaignId_idx" ON "survey_zone"("campaignId");

-- CreateIndex
CREATE INDEX "survey_assignment_zoneId_idx" ON "survey_assignment"("zoneId");

-- CreateIndex
CREATE INDEX "survey_assignment_assigneeId_idx" ON "survey_assignment"("assigneeId");

-- CreateIndex
CREATE INDEX "survey_assignment_status_idx" ON "survey_assignment"("status");

-- CreateIndex
CREATE INDEX "house_surveyAssignmentId_idx" ON "house"("surveyAssignmentId");

-- AddForeignKey
ALTER TABLE "house" ADD CONSTRAINT "house_surveyAssignmentId_fkey" FOREIGN KEY ("surveyAssignmentId") REFERENCES "survey_assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_campaign" ADD CONSTRAINT "survey_campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_zone" ADD CONSTRAINT "survey_zone_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "survey_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_zone" ADD CONSTRAINT "survey_zone_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "address_ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_assignment" ADD CONSTRAINT "survey_assignment_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "survey_zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_assignment" ADD CONSTRAINT "survey_assignment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_assignment" ADD CONSTRAINT "survey_assignment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_assignment" ADD CONSTRAINT "survey_assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

