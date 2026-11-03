-- Danh mục phòng ban (chỉ để chọn/lọc người dùng) + liên kết app_user.departmentId.

-- AlterTable
ALTER TABLE "app_user" ADD COLUMN     "departmentId" TEXT;

-- CreateTable
CREATE TABLE "department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wardId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "department_wardId_idx" ON "department"("wardId");

-- CreateIndex
CREATE INDEX "app_user_departmentId_idx" ON "app_user"("departmentId");

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "address_ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill: mỗi giá trị "unit" đang có (bỏ khoảng trắng thừa, không phân biệt hoa/thường) thành 1 phòng ban
-- cấp tỉnh, rồi gắn người dùng vào. Các cách gõ khác nhau ("Phòng KT" / "Phòng Kinh tế") vẫn là 2 mục để admin tự gộp.
-- id sinh bằng md5 (không cần extension pgcrypto/uuid-ossp).
CREATE TEMP TABLE _dept_backfill AS
SELECT g.key, g.name, md5(random()::text || clock_timestamp()::text || g.key)::uuid::text AS id
FROM (
  SELECT lower(regexp_replace(btrim("unit"), '\s+', ' ', 'g')) AS key,
         -- Giữ cách viết của tài khoản tạo sớm nhất (không lấy min() — sẽ ra chữ thường nếu có người gõ thường).
         (array_agg(regexp_replace(btrim("unit"), '\s+', ' ', 'g') ORDER BY "createdAt", id))[1] AS name
  FROM "app_user"
  WHERE "unit" IS NOT NULL AND btrim("unit") <> ''
  GROUP BY 1
) g;

INSERT INTO "department" ("id", "name", "wardId", "isActive", "createdAt", "updatedAt")
SELECT id, name, NULL, true, now(), now() FROM _dept_backfill;

UPDATE "app_user" u
SET "departmentId" = b.id, "unit" = b.name
FROM _dept_backfill b
WHERE u."unit" IS NOT NULL AND lower(regexp_replace(btrim(u."unit"), '\s+', ' ', 'g')) = b.key;

DROP TABLE _dept_backfill;
