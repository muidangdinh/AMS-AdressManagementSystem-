-- Phase 11 — Thông báo & nhắc nhở (giao việc).

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ASSIGNED', 'STATUS_CHANGED', 'DUE_SOON', 'OVERDUE', 'REMINDER', 'ISSUE_REPORTED');

-- CreateEnum
CREATE TYPE "NotificationEntity" AS ENUM ('TASK', 'SURVEY_ASSIGNMENT', 'HOUSE_CASE');

-- AlterTable
ALTER TABLE "house_case" ADD COLUMN     "dueDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "entityType" "NotificationEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "actorId" TEXT,
    "readAt" TIMESTAMP(3),
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_dedupeKey_key" ON "notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_idx" ON "notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notification_createdAt_idx" ON "notification"("createdAt");

-- CreateIndex
CREATE INDEX "notification_entityType_entityId_idx" ON "notification"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
