-- Phase 11 Đợt 2 — chỉ tiêu, dòng thời gian và báo vấn đề cho nhiệm vụ khảo sát.

-- AlterTable
ALTER TABLE "survey_assignment" ADD COLUMN     "targetCount" INTEGER;

-- CreateTable
CREATE TABLE "survey_assignment_event" (
    "id" SERIAL NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "fromStatus" "AssignmentStatus",
    "toStatus" "AssignmentStatus",
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_assignment_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "survey_assignment_event_assignmentId_idx" ON "survey_assignment_event"("assignmentId");

-- AddForeignKey
ALTER TABLE "survey_assignment_event" ADD CONSTRAINT "survey_assignment_event_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "survey_assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_assignment_event" ADD CONSTRAINT "survey_assignment_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Điền sẵn dòng thời gian từ các mốc thời gian đã có trên nhiệm vụ cũ (best-effort: hệ thống trước đây
-- không lưu mốc "bắt đầu" nên nhiệm vụ cũ không có dòng STARTED).
INSERT INTO "survey_assignment_event" ("assignmentId", "action", "toStatus", "actorId", "createdAt")
SELECT "id", 'CREATED', 'ASSIGNED', "createdById", "createdAt" FROM "survey_assignment";

INSERT INTO "survey_assignment_event" ("assignmentId", "action", "fromStatus", "toStatus", "actorId", "createdAt")
SELECT "id", 'SUBMITTED', 'IN_PROGRESS', 'SUBMITTED', "assigneeId", "submittedAt"
FROM "survey_assignment" WHERE "submittedAt" IS NOT NULL;

-- requestRevisit luôn ghi reviewNote (bắt buộc), complete luôn xoá reviewNote — dùng đó để phân biệt hai loại duyệt.
INSERT INTO "survey_assignment_event" ("assignmentId", "action", "fromStatus", "toStatus", "note", "actorId", "createdAt")
SELECT "id",
       CASE WHEN "reviewNote" IS NOT NULL THEN 'REVISIT_REQUESTED' ELSE 'COMPLETED' END,
       'SUBMITTED',
       CASE WHEN "reviewNote" IS NOT NULL THEN 'NEEDS_REVISIT'::"AssignmentStatus" ELSE 'COMPLETED'::"AssignmentStatus" END,
       "reviewNote", "reviewedById", "reviewedAt"
FROM "survey_assignment" WHERE "reviewedAt" IS NOT NULL;
