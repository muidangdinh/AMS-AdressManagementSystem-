-- Phase 10 — Hồ sơ – quy trình (IX. Quản lý hồ sơ – quy trình)
-- Thêm 2 bảng: house_case (hồ sơ, liên kết House khi xác định được) và
-- house_case_event (dòng thời gian xử lý). Lớp mỏng bọc ngoài các quy
-- trình Phase 6-9 đã có, không viết lại. Xem ghi chú prisma/schema.prisma.

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('RECEIVED', 'ASSIGNED', 'REVIEWING', 'SURVEYING', 'NUMBERING', 'APPROVED', 'PLATE_ISSUED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CaseRequestType" AS ENUM ('NEW', 'CHANGE', 'REISSUE');


-- CreateTable
CREATE TABLE "house_case" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "applicantPhone" TEXT,
    "requestType" "CaseRequestType" NOT NULL DEFAULT 'NEW',
    "description" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'RECEIVED',
    "houseId" TEXT,
    "assignedToId" TEXT,
    "rejectedReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "house_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "house_case_event" (
    "id" SERIAL NOT NULL,
    "caseId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "fromStatus" "CaseStatus",
    "toStatus" "CaseStatus",
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "house_case_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "house_case_caseNumber_key" ON "house_case"("caseNumber");

-- CreateIndex
CREATE INDEX "house_case_status_idx" ON "house_case"("status");

-- CreateIndex
CREATE INDEX "house_case_houseId_idx" ON "house_case"("houseId");

-- CreateIndex
CREATE INDEX "house_case_event_caseId_idx" ON "house_case_event"("caseId");

-- AddForeignKey
ALTER TABLE "house_case" ADD CONSTRAINT "house_case_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "house"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_case" ADD CONSTRAINT "house_case_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_case" ADD CONSTRAINT "house_case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_case_event" ADD CONSTRAINT "house_case_event_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "house_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_case_event" ADD CONSTRAINT "house_case_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

