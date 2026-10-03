-- Hiện trạng nhà: enum cứng -> danh mục quản lý được (CRUD).
CREATE TABLE "house_usage_status" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "house_usage_status_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "house_usage_status_name_key" ON "house_usage_status"("name");

INSERT INTO "house_usage_status" ("id", "name", "sortOrder", "updatedAt") VALUES
  ('00000000-0000-4000-8000-000000000001', 'Nhà ở', 1, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000002', 'Bỏ trống', 2, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000003', 'Đang xây dựng', 3, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000004', 'Kinh doanh / cho thuê', 4, CURRENT_TIMESTAMP);

ALTER TABLE "house" ADD COLUMN "usageStatusId" TEXT;

UPDATE "house" SET "usageStatusId" = CASE "usageStatus"::text
  WHEN 'RESIDENTIAL' THEN '00000000-0000-4000-8000-000000000001'
  WHEN 'VACANT' THEN '00000000-0000-4000-8000-000000000002'
  WHEN 'UNDER_CONSTRUCTION' THEN '00000000-0000-4000-8000-000000000003'
  WHEN 'BUSINESS' THEN '00000000-0000-4000-8000-000000000004'
END
WHERE "usageStatus" IS NOT NULL;

ALTER TABLE "house" DROP COLUMN "usageStatus";
DROP TYPE "HouseUsageStatus";

ALTER TABLE "house" ADD CONSTRAINT "house_usageStatusId_fkey"
  FOREIGN KEY ("usageStatusId") REFERENCES "house_usage_status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
