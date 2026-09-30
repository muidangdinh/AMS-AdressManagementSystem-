-- Phase 6 — Danh mục địa chỉ chuẩn hoá (IV. Quản lý dữ liệu địa chỉ)
-- Thêm 5 bảng danh mục (District/Ward/Hamlet/Street/Alley) + cột FK tuỳ chọn
-- trên House. Cột text tự do cũ (street/ward/district) GIỮ NGUYÊN song song —
-- xem ghi chú trong prisma/schema.prisma.

-- AlterTable
ALTER TABLE "house" ADD COLUMN     "alleyId" TEXT,
ADD COLUMN     "districtId" TEXT,
ADD COLUMN     "hamletId" TEXT,
ADD COLUMN     "streetId" TEXT,
ADD COLUMN     "wardId" TEXT;

-- CreateTable
CREATE TABLE "address_district" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "address_district_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address_ward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "districtId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "address_ward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address_hamlet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "address_hamlet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address_street" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "address_street_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "address_alley" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "streetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "address_alley_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "address_district_name_key" ON "address_district"("name");

-- CreateIndex
CREATE UNIQUE INDEX "address_district_code_key" ON "address_district"("code");

-- CreateIndex
CREATE UNIQUE INDEX "address_ward_code_key" ON "address_ward"("code");

-- CreateIndex
CREATE UNIQUE INDEX "address_ward_name_districtId_key" ON "address_ward"("name", "districtId");

-- CreateIndex
CREATE UNIQUE INDEX "address_hamlet_name_wardId_key" ON "address_hamlet"("name", "wardId");

-- CreateIndex
CREATE UNIQUE INDEX "address_street_name_wardId_key" ON "address_street"("name", "wardId");

-- CreateIndex
CREATE UNIQUE INDEX "address_alley_name_streetId_key" ON "address_alley"("name", "streetId");

-- CreateIndex
CREATE INDEX "house_wardId_idx" ON "house"("wardId");

-- CreateIndex
CREATE INDEX "house_streetId_idx" ON "house"("streetId");

-- AddForeignKey
ALTER TABLE "house" ADD CONSTRAINT "house_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "address_district"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house" ADD CONSTRAINT "house_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "address_ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house" ADD CONSTRAINT "house_hamletId_fkey" FOREIGN KEY ("hamletId") REFERENCES "address_hamlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house" ADD CONSTRAINT "house_streetId_fkey" FOREIGN KEY ("streetId") REFERENCES "address_street"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house" ADD CONSTRAINT "house_alleyId_fkey" FOREIGN KEY ("alleyId") REFERENCES "address_alley"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_ward" ADD CONSTRAINT "address_ward_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "address_district"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_hamlet" ADD CONSTRAINT "address_hamlet_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "address_ward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_street" ADD CONSTRAINT "address_street_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "address_ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_alley" ADD CONSTRAINT "address_alley_streetId_fkey" FOREIGN KEY ("streetId") REFERENCES "address_street"("id") ON DELETE CASCADE ON UPDATE CASCADE;

