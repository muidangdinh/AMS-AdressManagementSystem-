-- AlterEnum
ALTER TYPE "NotificationEntity" ADD VALUE 'INSTALL_ASSIGNMENT';

-- AlterTable
ALTER TABLE "house_plate" ADD COLUMN "installAssignmentId" TEXT,
ADD COLUMN "revisitReason" TEXT,
ADD COLUMN "revisitRequestedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "install_campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "install_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "install_zone" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wardId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "install_zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "install_assignment" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "routeId" TEXT,
    "assigneeId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "note" TEXT,
    "targetCount" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "install_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "install_assignment_event" (
    "id" SERIAL NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "fromStatus" "AssignmentStatus",
    "toStatus" "AssignmentStatus",
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "install_assignment_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "install_campaign_status_idx" ON "install_campaign"("status");
CREATE INDEX "install_zone_campaignId_idx" ON "install_zone"("campaignId");
CREATE INDEX "install_assignment_zoneId_idx" ON "install_assignment"("zoneId");
CREATE INDEX "install_assignment_routeId_idx" ON "install_assignment"("routeId");
CREATE INDEX "install_assignment_assigneeId_idx" ON "install_assignment"("assigneeId");
CREATE INDEX "install_assignment_status_idx" ON "install_assignment"("status");
CREATE INDEX "install_assignment_event_assignmentId_idx" ON "install_assignment_event"("assignmentId");
CREATE INDEX "house_plate_installAssignmentId_idx" ON "house_plate"("installAssignmentId");

-- AddForeignKey
ALTER TABLE "house_plate" ADD CONSTRAINT "house_plate_installAssignmentId_fkey" FOREIGN KEY ("installAssignmentId") REFERENCES "install_assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "install_campaign" ADD CONSTRAINT "install_campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "install_zone" ADD CONSTRAINT "install_zone_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "install_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "install_zone" ADD CONSTRAINT "install_zone_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "address_ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "install_assignment" ADD CONSTRAINT "install_assignment_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "install_zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "install_assignment" ADD CONSTRAINT "install_assignment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "survey_route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "install_assignment" ADD CONSTRAINT "install_assignment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "install_assignment" ADD CONSTRAINT "install_assignment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "install_assignment" ADD CONSTRAINT "install_assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "install_assignment_event" ADD CONSTRAINT "install_assignment_event_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "install_assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "install_assignment_event" ADD CONSTRAINT "install_assignment_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
