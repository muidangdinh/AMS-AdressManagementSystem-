-- Cấp tổ chức của tài khoản: SYSTEM / WARD (UBND xã) / HAMLET (ấp, thôn).
-- Mọi tài khoản hiện có nhận SYSTEM (giữ nguyên phạm vi dữ liệu như trước); admin tự chuyển dần về xã/ấp.

-- CreateEnum
CREATE TYPE "UserLevel" AS ENUM ('SYSTEM', 'WARD', 'HAMLET');

-- AlterTable
ALTER TABLE "app_user" ADD COLUMN     "hamletId" TEXT,
ADD COLUMN     "level" "UserLevel" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "wardId" TEXT;

-- CreateIndex
CREATE INDEX "app_user_level_idx" ON "app_user"("level");

-- CreateIndex
CREATE INDEX "app_user_wardId_idx" ON "app_user"("wardId");

-- CreateIndex
CREATE INDEX "app_user_hamletId_idx" ON "app_user"("hamletId");

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "address_ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_hamletId_fkey" FOREIGN KEY ("hamletId") REFERENCES "address_hamlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

