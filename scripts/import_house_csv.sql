-- ============================================================
--  Import hồ sơ nhà từ CSV (sinh bởi scripts/excel-to-house-csv.js) vào bảng "house".
--
--  CSV được đọc từ STDIN của psql:
--    psql "$DATABASE_URL" -f scripts/import_house_csv.sql < house_import_thanh_hoa.csv
--  Qua docker (DB chạy trong container tayninh_postgres):
--    docker cp scripts/import_house_csv.sql tayninh_postgres:/tmp/
--    docker exec -i tayninh_postgres psql -U tayninh -d tayninh_gis \
--      -f /tmp/import_house_csv.sql < house_import_thanh_hoa.csv
--
--  Toàn bộ chạy trong 1 transaction: lỗi ở bất kỳ bước nào → không ghi gì.
--  - Xã/ấp tra theo tên trong danh mục (không phân biệt hoa thường/dấu, bỏ tiền tố "Xã"/"Ấp");
--    chưa có thì TẠO MỚI trong danh mục địa chỉ.
--  - latitude/longitude là NOT NULL: dòng chưa có tọa độ được ghi 0,0 (= "chưa có tọa độ",
--    lọc lại bằng WHERE latitude = 0 AND longitude = 0 để khảo sát bổ sung).
--  - houseNumber/street là NOT NULL: chưa có thì ghi chuỗi rỗng.
--  - Mỗi nhà có 1 dòng house_history action CREATE (giống tạo tay), changedById để trống.
--  - Chạy lại lần 2 sẽ dừng ở bước kiểm tra trùng id/qrCode (không nhân đôi dữ liệu).
-- ============================================================

\set ON_ERROR_STOP on
BEGIN;

-- Đã có sẵn trên DB chạy đủ migration (20261002120000_unaccent); giữ để script tự đủ.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TEMP TABLE house_import (
  "id" TEXT, "qrCode" TEXT, "houseNumber" TEXT, "street" TEXT, "ward" TEXT, "hamlet" TEXT,
  "ownerName" TEXT, "ownerPhone" TEXT, "ownerIdNumber" TEXT, "buildingType" TEXT,
  "floors" INTEGER, "area" DOUBLE PRECISION, "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION, "soTo" TEXT, "soThua" TEXT, "householdSize" INTEGER, "note" TEXT
) ON COMMIT DROP;

\copy house_import FROM pstdin WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

-- Kiểm tra trước khi ghi
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM house_import i
  JOIN house h ON h.id = i.id OR h."qrCode" = i."qrCode";
  IF n > 0 THEN
    RAISE EXCEPTION '% dòng trùng id/qrCode với dữ liệu đã có — có thể file này đã được import', n;
  END IF;

  SELECT count(*) INTO n FROM house_import WHERE coalesce(trim("ownerName"), '') = '' OR coalesce(trim("ward"), '') = '';
  IF n > 0 THEN
    RAISE EXCEPTION '% dòng thiếu ownerName hoặc ward', n;
  END IF;
END $$;

-- So khớp tên danh mục: bỏ dấu, hoa thường, tiền tố hành chính.
CREATE OR REPLACE FUNCTION pg_temp.addr_key(s TEXT, prefix TEXT) RETURNS TEXT AS $$
  SELECT regexp_replace(lower(unaccent(trim(s))), '^' || lower(unaccent(prefix)) || '\s+', '')
$$ LANGUAGE sql STABLE;

-- 1) Xã/phường: tạo nếu chưa có
INSERT INTO address_ward (id, name, "updatedAt")
SELECT gen_random_uuid()::text, w.ward, now()
FROM (SELECT DISTINCT trim(ward) AS ward FROM house_import) w
WHERE NOT EXISTS (
  SELECT 1 FROM address_ward aw
  WHERE pg_temp.addr_key(aw.name, 'xã') = pg_temp.addr_key(w.ward, 'xã')
);

CREATE TEMP TABLE ward_map AS
SELECT DISTINCT ON (i.ward) i.ward, aw.id AS ward_id, aw."districtId" AS district_id
FROM (SELECT DISTINCT trim(ward) AS ward FROM house_import) i
JOIN address_ward aw ON pg_temp.addr_key(aw.name, 'xã') = pg_temp.addr_key(i.ward, 'xã')
ORDER BY i.ward, aw."createdAt";

-- 2) Ấp thuộc xã: tạo nếu chưa có
INSERT INTO address_hamlet (id, name, "wardId", "updatedAt")
SELECT gen_random_uuid()::text, x.hamlet, x.ward_id, now()
FROM (
  SELECT DISTINCT trim(i.hamlet) AS hamlet, wm.ward_id
  FROM house_import i JOIN ward_map wm ON wm.ward = trim(i.ward)
  WHERE coalesce(trim(i.hamlet), '') <> ''
) x
WHERE NOT EXISTS (
  SELECT 1 FROM address_hamlet ah
  WHERE ah."wardId" = x.ward_id
    AND pg_temp.addr_key(ah.name, 'ấp') = pg_temp.addr_key(x.hamlet, 'ấp')
);

CREATE TEMP TABLE hamlet_map AS
SELECT DISTINCT ON (wm.ward, x.hamlet) wm.ward, x.hamlet, ah.id AS hamlet_id
FROM (SELECT DISTINCT trim(ward) AS ward, trim(hamlet) AS hamlet FROM house_import) x
JOIN ward_map wm ON wm.ward = x.ward
JOIN address_hamlet ah ON ah."wardId" = wm.ward_id
  AND pg_temp.addr_key(ah.name, 'ấp') = pg_temp.addr_key(x.hamlet, 'ấp')
ORDER BY wm.ward, x.hamlet, ah."createdAt";

-- 3) Hồ sơ nhà
INSERT INTO house (
  id, "qrCode", "houseNumber", street, ward, "wardId", "districtId", "hamletId",
  "ownerName", "ownerPhone", "ownerIdNumber", "buildingType", floors, area,
  latitude, longitude, "soTo", "soThua", note, "updatedAt"
)
SELECT
  i.id, i."qrCode", coalesce(trim(i."houseNumber"), ''), coalesce(trim(i.street), ''),
  trim(i.ward), wm.ward_id, wm.district_id, hm.hamlet_id,
  trim(i."ownerName"), nullif(trim(i."ownerPhone"), ''), nullif(trim(i."ownerIdNumber"), ''),
  coalesce(nullif(trim(i."buildingType"), ''), 'SINGLE_HOUSE')::"BuildingType", i.floors, i.area,
  coalesce(i.latitude, 0), coalesce(i.longitude, 0),
  nullif(trim(i."soTo"), ''), nullif(trim(i."soThua"), ''), nullif(trim(i.note), ''), now()
FROM house_import i
JOIN ward_map wm ON wm.ward = trim(i.ward)
LEFT JOIN hamlet_map hm ON hm.ward = trim(i.ward) AND hm.hamlet = trim(i.hamlet);

-- 4) Lịch sử tạo mới
INSERT INTO house_history ("houseId", action, changes)
SELECT i.id, 'CREATE', jsonb_build_object('source', 'import-csv', 'householdSize', i."householdSize")
FROM house_import i;

-- Tổng kết
SELECT trim(i.hamlet) AS "Ấp", count(*) AS "Số hộ", sum(i."householdSize") AS "Nhân khẩu"
FROM house_import i GROUP BY 1 ORDER BY 1;

COMMIT;
