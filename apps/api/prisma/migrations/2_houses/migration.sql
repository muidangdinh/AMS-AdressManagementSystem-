-- CreateEnum
CREATE TYPE "HouseStatus" AS ENUM ('PENDING', 'APPROVED', 'NEEDS_ADJUST');

-- CreateEnum
CREATE TYPE "BuildingType" AS ENUM ('SINGLE_HOUSE', 'SHOP', 'OFFICE_BUILDING', 'APARTMENT');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('FACADE', 'CONDITION');

-- CreateTable
CREATE TABLE "house" (
    "id" TEXT NOT NULL,
    "houseNumber" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "ward" TEXT NOT NULL,
    "district" TEXT,
    "ownerName" TEXT NOT NULL,
    "ownerPhone" TEXT,
    "buildingType" "BuildingType" NOT NULL DEFAULT 'SINGLE_HOUSE',
    "floors" INTEGER,
    "area" DOUBLE PRECISION,
    "status" "HouseStatus" NOT NULL DEFAULT 'PENDING',
    "qrCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "soTo" TEXT,
    "soThua" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "house_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "house_photo" (
    "id" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "PhotoType" NOT NULL DEFAULT 'CONDITION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "house_photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "house_history" (
    "id" SERIAL NOT NULL,
    "houseId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "house_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "house_qrCode_key" ON "house"("qrCode");

-- CreateIndex
CREATE INDEX "house_street_idx" ON "house"("street");

-- CreateIndex
CREATE INDEX "house_ward_idx" ON "house"("ward");

-- CreateIndex
CREATE INDEX "house_status_idx" ON "house"("status");

-- CreateIndex
CREATE INDEX "house_photo_houseId_idx" ON "house_photo"("houseId");

-- CreateIndex
CREATE INDEX "house_history_houseId_idx" ON "house_history"("houseId");

-- AddForeignKey
ALTER TABLE "house" ADD CONSTRAINT "house_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_photo" ADD CONSTRAINT "house_photo_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "house"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_history" ADD CONSTRAINT "house_history_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "house"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_history" ADD CONSTRAINT "house_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

