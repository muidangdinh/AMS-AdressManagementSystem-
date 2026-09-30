-- Ngày nhà được cấp số (chuyển sang APPROVED) — tự ghi ở service khi đổi trạng thái.

-- AlterTable
ALTER TABLE "house" ADD COLUMN     "approvedAt" TIMESTAMP(3);
