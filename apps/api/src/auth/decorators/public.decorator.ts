import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Đánh dấu route/controller không cần JWT (vd: /health, /auth/login). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
