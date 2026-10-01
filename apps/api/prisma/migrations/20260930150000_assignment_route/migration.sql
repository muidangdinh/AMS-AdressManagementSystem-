-- AlterTable
ALTER TABLE "survey_assignment" ADD COLUMN "routeId" TEXT;

-- CreateIndex
CREATE INDEX "survey_assignment_routeId_idx" ON "survey_assignment"("routeId");

-- AddForeignKey
ALTER TABLE "survey_assignment" ADD CONSTRAINT "survey_assignment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "survey_route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
