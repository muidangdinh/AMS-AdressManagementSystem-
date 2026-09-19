-- TN-05 — Góp ý khách hàng 11/09/2026 (mục Tổng quan): lời chào cần kèm
-- chức vụ cán bộ. Cột tự do, tuỳ chọn — tài khoản cũ vẫn hợp lệ với NULL.

-- AlterTable
ALTER TABLE "app_user" ADD COLUMN     "position" TEXT;
