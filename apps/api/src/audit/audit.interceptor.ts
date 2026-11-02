import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
/**
 * Đánh dấu đã đọc thông báo và làm mới token diễn ra rất thường xuyên, không có giá trị truy vết —
 * bỏ qua khỏi nhật ký (refresh token dùng lại được ghi riêng ở AuthService).
 */
const SKIP_AUDIT_PATH = /^\/api\/(notifications\/(read-all|[^/]+\/read)|auth\/refresh)\/?(\?.*)?$/;
/** So theo mẫu (không theo tên chính xác) để trường mới như `newPassword` không bị lọt. */
const SENSITIVE_FIELD = /passw(or)?d|token|secret|ownerIdNumber/i;

function maskSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSensitive);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [key, SENSITIVE_FIELD.test(key) ? '***' : maskSensitive(inner)]),
  );
}

function sanitize(body: Record<string, unknown> | undefined) {
  if (!body || Object.keys(body).length === 0) return undefined;
  return maskSensitive(body) as Record<string, unknown>;
}

/**
 * Ghi nhật ký mọi thao tác thay đổi dữ liệu (POST/PATCH/PUT/DELETE)
 * sau khi request xử lý thành công. Đăng ký toàn cục ở AppModule.
 * Lỗi ghi log không được làm hỏng response cho người dùng.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl, user, body, ip } = request;

    if (!MUTATING_METHODS.has(method) || SKIP_AUDIT_PATH.test(originalUrl)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        this.auditService
          .record({
            userId: user?.id ?? null,
            method,
            path: originalUrl,
            action: `${method} ${originalUrl}`,
            ip,
            metadata: sanitize(body),
          })
          .catch((err) => this.logger.error('Không ghi được audit log', err));
      }),
    );
  }
}
