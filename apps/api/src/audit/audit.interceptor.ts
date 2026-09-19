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
const SENSITIVE_FIELDS = ['password', 'passwordHash', 'accessToken', 'ownerIdNumber'];

function sanitize(body: Record<string, unknown> | undefined) {
  if (!body || Object.keys(body).length === 0) return undefined;
  const clone: Record<string, unknown> = { ...body };
  for (const field of SENSITIVE_FIELDS) {
    if (field in clone) clone[field] = '***';
  }
  return clone;
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

    if (!MUTATING_METHODS.has(method)) {
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
