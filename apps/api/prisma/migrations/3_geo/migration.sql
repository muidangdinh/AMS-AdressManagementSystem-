-- Phase 3 — Bản đồ GIS & Tra cứu (I)
-- Thêm cột không gian `geom` cho House, tự động đồng bộ từ latitude/longitude
-- bằng trigger DB (ứng dụng chỉ cần ghi lat/lng như trước, không cần biết geom).

-- AlterTable
ALTER TABLE "house" ADD COLUMN     "geom" geometry(Point, 4326);

-- Trigger: tự động set geom mỗi khi insert hoặc lat/lng thay đổi
CREATE OR REPLACE FUNCTION house_sync_geom() RETURNS trigger AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER house_sync_geom_trigger
BEFORE INSERT OR UPDATE OF latitude, longitude ON "house"
FOR EACH ROW EXECUTE FUNCTION house_sync_geom();

-- Backfill dữ liệu đã có sẵn (Phase 2 tạo trước khi có cột geom)
UPDATE "house" SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326);

-- Chỉ mục không gian cho truy vấn bán kính (ST_DWithin)
CREATE INDEX "house_geom_idx" ON "house" USING GIST ("geom");
