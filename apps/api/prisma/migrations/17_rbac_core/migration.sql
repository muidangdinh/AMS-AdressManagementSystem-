-- Phase 17 — RBAC động (vai trò + quyền). Additive: chỉ THÊM 4 bảng mới.
-- KHÔNG đụng cột "app_user"."role" (giữ legacy để backfill "user_role" + rollback).
-- KHÔNG đụng "house_geom_idx" (GIST index cho ST_DWithin, tạo ở 03_geo, Unsupported với Prisma).

-- CreateTable
CREATE TABLE "app_role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_role_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "role_permission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("roleId","permissionId")
);
-- CreateTable
CREATE TABLE "user_role" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "user_role_pkey" PRIMARY KEY ("userId","roleId")
);
-- CreateIndex
CREATE UNIQUE INDEX "app_role_code_key" ON "app_role"("code");
-- CreateIndex
CREATE UNIQUE INDEX "permission_code_key" ON "permission"("code");
-- CreateIndex
CREATE INDEX "role_permission_permissionId_idx" ON "role_permission"("permissionId");
-- CreateIndex
CREATE INDEX "user_role_roleId_idx" ON "user_role"("roleId");
-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "app_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "app_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
