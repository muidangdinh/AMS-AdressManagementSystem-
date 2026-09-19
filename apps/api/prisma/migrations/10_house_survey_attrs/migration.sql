-- Phase 11 (bổ sung) — 5 tính năng khảo sát nhà theo thiết kế tham khảo (UI/1-6.jpg)
-- Additive-first: chỉ thêm enum/cột mới, không đổi ý nghĩa field cũ.
-- LƯU Ý: KHÔNG drop "house_geom_idx" (chỉ mục GIST cho ST_DWithin ở /houses/nearby,
-- tạo ở migration 3_geo) — Prisma không biết cột `geom`/index này vì `geom` là
-- Unsupported type, `prisma migrate diff` sẽ đề xuất xoá nhầm nếu chạy lại từ DB thật.

-- CreateEnum
CREATE TYPE "HouseUsageStatus" AS ENUM ('RESIDENTIAL', 'VACANT', 'UNDER_CONSTRUCTION', 'BUSINESS');

-- CreateEnum
CREATE TYPE "PlateNeed" AS ENUM ('NEEDED', 'NOT_NEEDED', 'ALREADY_HAS');

-- CreateEnum
CREATE TYPE "HouseReviewStage" AS ENUM ('PROPOSED', 'CHECKED', 'APPROVED', 'SIGNED', 'REJECTED');

-- AlterEnum
ALTER TYPE "PhotoType" ADD VALUE 'PLATE';

-- AlterTable
ALTER TABLE "house" ADD COLUMN     "note" TEXT,
ADD COLUMN     "plateNeed" "PlateNeed",
ADD COLUMN     "reviewStage" "HouseReviewStage" NOT NULL DEFAULT 'PROPOSED',
ADD COLUMN     "side" "NumberingSide" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "usageStatus" "HouseUsageStatus";

-- CreateIndex
CREATE INDEX "house_reviewStage_idx" ON "house"("reviewStage");
