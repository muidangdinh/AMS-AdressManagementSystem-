-- Thêm trường số CCCD/CMND chủ sở hữu vào hồ sơ số nhà (PII nhạy cảm,
-- chỉ đọc được qua route yêu cầu JWT — xem comment trong schema.prisma).

-- AlterTable
ALTER TABLE "house" ADD COLUMN "ownerIdNumber" TEXT;
