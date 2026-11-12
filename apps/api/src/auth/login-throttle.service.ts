import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { isLoginThrottleEnabled } from './auth.config';

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_TRACKED = 10_000;

interface Attempt {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

/**
 * Chặn dò mật khẩu: sai 5 lần trong 15 phút thì tên đăng nhập đó bị khóa đăng nhập 15 phút.
 * Đếm theo TÊN ĐĂNG NHẬP (kể cả tên không tồn tại, để không lộ tài khoản nào có thật), không theo IP
 * vì sau reverse proxy và NAT cơ quan nhiều người dùng chung 1 IP. Lưu trong bộ nhớ: API chạy 1 instance,
 * khởi động lại thì đếm lại từ đầu.
 *
 * Tạm tắt mặc định (chưa cần dùng); bật lại bằng biến môi trường LOGIN_THROTTLE_ENABLED=true.
 */
@Injectable()
export class LoginThrottleService {
  private readonly attempts = new Map<string, Attempt>();

  private key(username: string) {
    return username.trim().toLowerCase();
  }

  assertAllowed(username: string, now = Date.now()) {
    if (!isLoginThrottleEnabled()) return;
    const attempt = this.attempts.get(this.key(username));
    if (!attempt || attempt.lockedUntil <= now) return;
    const minutes = Math.ceil((attempt.lockedUntil - now) / 60_000);
    throw new HttpException(
      `Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${minutes} phút.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  recordFailure(username: string, now = Date.now()) {
    if (!isLoginThrottleEnabled()) return;
    const key = this.key(username);
    const current = this.attempts.get(key);
    const attempt: Attempt =
      current && now - current.windowStart < WINDOW_MS
        ? current
        : { failures: 0, windowStart: now, lockedUntil: 0 };
    attempt.failures += 1;
    if (attempt.failures >= MAX_FAILURES) attempt.lockedUntil = now + LOCK_MS;
    // Đưa xuống cuối Map để khi vượt giới hạn thì bản ghi lâu không đổi bị bỏ trước.
    this.attempts.delete(key);
    this.attempts.set(key, attempt);
    if (this.attempts.size > MAX_TRACKED) this.prune(now);
  }

  recordSuccess(username: string) {
    this.attempts.delete(this.key(username));
  }

  private prune(now: number) {
    for (const [key, attempt] of this.attempts) {
      if (attempt.lockedUntil <= now && now - attempt.windowStart >= WINDOW_MS) this.attempts.delete(key);
    }
    for (const key of this.attempts.keys()) {
      if (this.attempts.size <= MAX_TRACKED) break;
      this.attempts.delete(key);
    }
  }
}
