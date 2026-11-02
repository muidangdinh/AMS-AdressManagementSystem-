/** Giá trị mặc định cũ trong code — từng được dùng khi thiếu biến môi trường, không bao giờ chấp nhận lại. */
const FORBIDDEN_SECRETS = new Set(['dev_only_change_me', 'change_me_generate_a_strong_random_secret']);

/**
 * Secret ký JWT. Không có giá trị dự phòng: thiếu hoặc còn là chuỗi mẫu thì API dừng ngay lúc khởi động,
 * tránh chạy với secret ai cũng biết. Phải gọi lúc khởi tạo DI (sau ConfigModule.forRoot nạp `.env`),
 * không gọi ở phạm vi module/decorator.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || FORBIDDEN_SECRETS.has(secret)) {
    throw new Error(
      'JWT_SECRET chưa được đặt hoặc còn là giá trị mẫu. Sinh secret bằng: ' +
        `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`,
    );
  }
  return secret;
}

/** Thời hạn access token. Ngắn vì phiên được duy trì bằng refresh token. */
export function getAccessTokenTtl(): string {
  return process.env.JWT_EXPIRES_IN?.trim() || '15m';
}

/** Thời hạn refresh token (tính lại sau mỗi lần làm mới, nên phiên còn dùng thì không hết hạn). */
export function getRefreshTokenTtlMs(): number {
  const days = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? 30);
  return (Number.isFinite(days) && days > 0 ? days : 30) * 24 * 3600 * 1000;
}
