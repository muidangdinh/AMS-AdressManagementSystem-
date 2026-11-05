-- Index hỗ trợ lọc bản đồ theo bbox (latitude/longitude).
CREATE INDEX "house_latitude_longitude_idx" ON "house"("latitude", "longitude");
