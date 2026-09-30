-- Phase 11 Đợt 2b — đánh dấu từng nhà cần khảo sát lại (thay vì bắt cán bộ tạo nhà mới trùng).

-- AlterTable
ALTER TABLE "house" ADD COLUMN     "revisitReason" TEXT,
ADD COLUMN     "revisitRequestedAt" TIMESTAMP(3);
