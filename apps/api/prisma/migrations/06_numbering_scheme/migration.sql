-- Phase 7 — Lập phương án đánh số (V. Đánh số nhà)
-- Thêm 2 bảng: numbering_scheme (phương án theo tuyến đường) và
-- numbering_scheme_item (từng nhà trong phương án, kèm thứ tự + số đề xuất).
-- Xem ghi chú trong prisma/schema.prisma.

-- CreateEnum
CREATE TYPE "NumberingSchemeStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NumberingSide" AS ENUM ('ODD', 'EVEN', 'NONE');


-- CreateTable
CREATE TABLE "numbering_scheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "streetId" TEXT NOT NULL,
    "wardId" TEXT,
    "description" TEXT,
    "oddEvenSplit" BOOLEAN NOT NULL DEFAULT true,
    "startNumber" INTEGER NOT NULL DEFAULT 1,
    "step" INTEGER NOT NULL DEFAULT 2,
    "status" "NumberingSchemeStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "numbering_scheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "numbering_scheme_item" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "side" "NumberingSide" NOT NULL DEFAULT 'NONE',
    "sequenceOrder" INTEGER NOT NULL,
    "proposedNumber" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "numbering_scheme_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "numbering_scheme_streetId_idx" ON "numbering_scheme"("streetId");

-- CreateIndex
CREATE INDEX "numbering_scheme_status_idx" ON "numbering_scheme"("status");

-- CreateIndex
CREATE INDEX "numbering_scheme_item_schemeId_idx" ON "numbering_scheme_item"("schemeId");

-- CreateIndex
CREATE UNIQUE INDEX "numbering_scheme_item_schemeId_houseId_key" ON "numbering_scheme_item"("schemeId", "houseId");

-- AddForeignKey
ALTER TABLE "numbering_scheme" ADD CONSTRAINT "numbering_scheme_streetId_fkey" FOREIGN KEY ("streetId") REFERENCES "address_street"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numbering_scheme" ADD CONSTRAINT "numbering_scheme_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "address_ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numbering_scheme" ADD CONSTRAINT "numbering_scheme_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numbering_scheme" ADD CONSTRAINT "numbering_scheme_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numbering_scheme_item" ADD CONSTRAINT "numbering_scheme_item_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "numbering_scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numbering_scheme_item" ADD CONSTRAINT "numbering_scheme_item_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "house"("id") ON DELETE CASCADE ON UPDATE CASCADE;

