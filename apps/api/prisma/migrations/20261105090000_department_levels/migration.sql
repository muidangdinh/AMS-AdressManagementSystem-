-- Phòng ban có cấp: thuộc UBND xã (WARD) hoặc thuộc ấp/thôn (HAMLET). Bỏ "phòng ban cấp tỉnh".
-- - Phòng ban đã gắn xã → cấp xã.
-- - Phòng ban cấp tỉnh cũ (wardId NULL, tạo từ ô "Đơn vị") → level NULL = "chưa phân cấp": giữ nguyên người
--   đang gán (nhân sự xã/ấp), admin tự chuyển sang cấp xã/ấp hoặc xóa.
-- - Tài khoản hệ thống không còn thuộc phòng ban: gỡ liên kết, GIỮ chữ "unit" để vẫn hiện đơn vị như cũ.

-- CreateEnum
CREATE TYPE "DepartmentLevel" AS ENUM ('WARD', 'HAMLET');

-- AlterTable
ALTER TABLE "department" ADD COLUMN     "hamletId" TEXT,
ADD COLUMN     "level" "DepartmentLevel";

-- CreateIndex
CREATE INDEX "department_hamletId_idx" ON "department"("hamletId");

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_hamletId_fkey" FOREIGN KEY ("hamletId") REFERENCES "address_hamlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill
UPDATE "department" SET "level" = 'WARD' WHERE "wardId" IS NOT NULL;
UPDATE "app_user" SET "departmentId" = NULL WHERE "level" = 'SYSTEM' AND "departmentId" IS NOT NULL;
