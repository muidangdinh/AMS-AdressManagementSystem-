-- Phiên bản token theo người dùng: tăng lên để vô hiệu hóa mọi token đã phát hành.
ALTER TABLE "app_user" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Refresh token (chỉ lưu SHA-256).
CREATE TABLE "refresh_token" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_token_tokenHash_key" ON "refresh_token"("tokenHash");
CREATE INDEX "refresh_token_userId_idx" ON "refresh_token"("userId");
CREATE INDEX "refresh_token_familyId_idx" ON "refresh_token"("familyId");
CREATE INDEX "refresh_token_expiresAt_idx" ON "refresh_token"("expiresAt");

ALTER TABLE "refresh_token"
    ADD CONSTRAINT "refresh_token_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Che mật khẩu đã lỡ ghi dạng rõ vào nhật ký bởi PATCH /api/auth/me/password
-- (AuditInterceptor trước đây không che currentPassword/newPassword).
UPDATE "audit_log"
SET "metadata" = "metadata" || '{"currentPassword": "***"}'::jsonb
WHERE "metadata" ? 'currentPassword';

UPDATE "audit_log"
SET "metadata" = "metadata" || '{"newPassword": "***"}'::jsonb
WHERE "metadata" ? 'newPassword';
