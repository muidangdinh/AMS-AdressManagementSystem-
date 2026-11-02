-- Chuyển tuyến đường từ "thuộc 1 phân vùng" sang kho tuyến dùng chung.
-- Giữ nguyên id tuyến nên routeId của nhiệm vụ khảo sát/thi công vẫn đúng.

ALTER TABLE "survey_route"
    ADD COLUMN "wardId" TEXT,
    ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "survey_zone_route" (
    "zoneId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_zone_route_pkey" PRIMARY KEY ("zoneId", "routeId")
);

-- Mỗi tuyến hiện có giữ liên kết với phân vùng cũ và lấy xã/phường của phân vùng đó.
INSERT INTO "survey_zone_route" ("zoneId", "routeId", "createdAt")
SELECT "zoneId", "id", "createdAt" FROM "survey_route";

UPDATE "survey_route" AS r
SET "wardId" = z."wardId"
FROM "survey_zone" AS z
WHERE r."zoneId" = z."id";

ALTER TABLE "survey_route" DROP CONSTRAINT "survey_route_zoneId_fkey";
DROP INDEX "survey_route_zoneId_idx";
ALTER TABLE "survey_route" DROP COLUMN "zoneId";

CREATE INDEX "survey_route_wardId_idx" ON "survey_route"("wardId");
CREATE INDEX "survey_zone_route_routeId_idx" ON "survey_zone_route"("routeId");

ALTER TABLE "survey_route"
    ADD CONSTRAINT "survey_route_wardId_fkey"
    FOREIGN KEY ("wardId") REFERENCES "address_ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "survey_zone_route"
    ADD CONSTRAINT "survey_zone_route_zoneId_fkey"
    FOREIGN KEY ("zoneId") REFERENCES "survey_zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "survey_zone_route"
    ADD CONSTRAINT "survey_zone_route_routeId_fkey"
    FOREIGN KEY ("routeId") REFERENCES "survey_route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
