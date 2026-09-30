-- Phase 8 — Biển số nhà như tài sản quản lý riêng (VI. Quản lý biển số nhà)
-- Thêm bảng house_plate: lịch sử cấp/thu hồi/cấp đổi/cấp lại biển số cho
-- từng House, tách khỏi cột House.qrCode cũ (giữ nguyên cho trang in tem).
-- Xem ghi chú trong prisma/schema.prisma.

-- CreateEnum
CREATE TYPE "PlateStatus" AS ENUM ('ISSUED', 'INSTALLED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PlateIssueReason" AS ENUM ('NEW', 'REPLACEMENT', 'REISSUE');


-- CreateTable
CREATE TABLE "house_plate" (
    "id" TEXT NOT NULL,
    "plateCode" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "status" "PlateStatus" NOT NULL DEFAULT 'ISSUED',
    "issueReason" "PlateIssueReason" NOT NULL DEFAULT 'NEW',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "installedAt" TIMESTAMP(3),
    "installedById" TEXT,
    "installPhotoUrl" TEXT,
    "notInstalledAt" TIMESTAMP(3),
    "notInstalledReason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "house_plate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "house_plate_plateCode_key" ON "house_plate"("plateCode");

-- CreateIndex
CREATE INDEX "house_plate_houseId_idx" ON "house_plate"("houseId");

-- CreateIndex
CREATE INDEX "house_plate_status_idx" ON "house_plate"("status");

-- AddForeignKey
ALTER TABLE "house_plate" ADD CONSTRAINT "house_plate_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "house"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_plate" ADD CONSTRAINT "house_plate_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_plate" ADD CONSTRAINT "house_plate_installedById_fkey" FOREIGN KEY ("installedById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_plate" ADD CONSTRAINT "house_plate_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

