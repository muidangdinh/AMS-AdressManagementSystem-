import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Danh mục địa chỉ (District/Ward/Hamlet/Street/Alley) dùng ràng buộc unique
 * (đơn hoặc kết hợp với parent) để chặn trùng tên. Hàm này dịch lỗi Prisma
 * P2002 thành 409 thân thiện; các lỗi khác được ném lại nguyên trạng.
 */
export function throwIfUniqueConflict(err: unknown, message: string): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new ConflictException(message);
  }
  throw err;
}
