import { Prisma } from '@prisma/client';

/**
 * PHASE 17 — Where fragment: người dùng đang hoạt động và (qua ít nhất một vai
 * trò còn hiệu lực) có quyền `code`. Dùng cho các dropdown "chọn người xử lý /
 * cán bộ khảo sát" thay cho việc lọc theo tên vai trò cứng.
 */
export function usersWithPermission(code: string): Prisma.UserWhereInput {
  return {
    isActive: true,
    roleLinks: {
      some: { role: { isActive: true, permissions: { some: { permission: { code } } } } },
    },
  };
}
