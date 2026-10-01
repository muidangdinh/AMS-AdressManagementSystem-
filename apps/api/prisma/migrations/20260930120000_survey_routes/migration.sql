-- CreateTable
CREATE TABLE "survey_route" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "streetId" TEXT,
    "startLat" DOUBLE PRECISION NOT NULL,
    "startLng" DOUBLE PRECISION NOT NULL,
    "endLat" DOUBLE PRECISION NOT NULL,
    "endLng" DOUBLE PRECISION NOT NULL,
    "path" JSONB NOT NULL,
    "lengthM" DOUBLE PRECISION,
    "snapped" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_route_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "survey_route_zoneId_idx" ON "survey_route"("zoneId");

-- AddForeignKey
ALTER TABLE "survey_route" ADD CONSTRAINT "survey_route_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "survey_zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_route" ADD CONSTRAINT "survey_route_streetId_fkey" FOREIGN KEY ("streetId") REFERENCES "address_street"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_route" ADD CONSTRAINT "survey_route_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
