import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from './types/authenticated-user';

/**
 * Phạm vi dữ liệu theo cấp tài khoản.
 * - SYSTEM, WARD: thấy toàn hệ thống (như trước khi có phân cấp).
 * - HAMLET: chỉ nhà (và biển số, hồ sơ gắn với nhà) thuộc ấp của mình; khảo sát/thi công chỉ
 *   nhiệm vụ được giao cho mình (xem survey-scope.ts, install-scope.ts); không thấy phương án đánh số.
 *
 * Fail-closed: tài khoản HAMLET mà ấp đã bị xóa (`hamletId` null) chỉ còn thấy phần được giao,
 * không bao giờ rơi về "thấy toàn bộ".
 */
type ScopeUser = Pick<AuthenticatedUser, 'id' | 'level' | 'hamletId'> | null | undefined;

export function isHamletScoped(user: ScopeUser): boolean {
  return user?.level === 'HAMLET';
}

/**
 * Ấp mà tài khoản bị giới hạn trong đó:
 * - `undefined`: không giới hạn.
 * - `string`: id ấp.
 * - `null`: tài khoản ấp nhưng mất ấp → chỉ còn thấy phần được giao.
 */
export function scopedHamletId(user: ScopeUser): string | null | undefined {
  if (!isHamletScoped(user)) return undefined;
  return user!.hamletId ?? null;
}

/**
 * Điều kiện Prisma trên `House` theo phạm vi tài khoản (rỗng = không giới hạn).
 * Cán bộ ấp thấy: nhà thuộc ấp mình, cộng nhà trong nhiệm vụ khảo sát/thi công được giao cho
 * chính mình (nhiệm vụ do xã giao có thể đi qua ấp khác — "phần được giao").
 */
export function houseScopeWhere(user: ScopeUser): Prisma.HouseWhereInput {
  const hamletId = scopedHamletId(user);
  if (hamletId === undefined) return {};
  const assigned: Prisma.HouseWhereInput[] = [
    { surveyAssignment: { assigneeId: user!.id } },
    { plates: { some: { installAssignment: { assigneeId: user!.id } } } },
  ];
  return { OR: hamletId ? [{ hamletId }, ...assigned] : assigned };
}

/** Điều kiện trên `HousePlate`: biển của nhà trong phạm vi, hoặc biển trong nhiệm vụ thi công của mình. */
export function plateScopeWhere(user: ScopeUser): Prisma.HousePlateWhereInput {
  if (!isHamletScoped(user)) return {};
  return {
    OR: [{ house: houseScopeWhere(user) }, { installAssignment: { assigneeId: user!.id } }],
  };
}

/**
 * Điều kiện trên `HouseCase`: hồ sơ gắn với nhà trong phạm vi, hoặc do mình tiếp nhận, hoặc được giao cho mình
 * (hồ sơ mới tiếp nhận thường chưa gắn nhà).
 */
export function caseScopeWhere(user: ScopeUser): Prisma.HouseCaseWhereInput {
  if (!isHamletScoped(user)) return {};
  return {
    OR: [{ house: houseScopeWhere(user) }, { createdById: user!.id }, { assignedToId: user!.id }],
  };
}

/**
 * Đoạn SQL thô để nối vào WHERE của câu truy vấn trên bảng `house`
 * (vd `WHERE ... ${houseScopeSql(user, 'h')}`), cùng điều kiện với `houseScopeWhere`.
 * Rỗng khi không giới hạn.
 */
export function houseScopeSql(user: ScopeUser, alias = 'house'): Prisma.Sql {
  const hamletId = scopedHamletId(user);
  if (hamletId === undefined) return Prisma.empty;
  const t = Prisma.raw(`"${alias}"`);
  const assigned = Prisma.sql`${t}."surveyAssignmentId" IN (SELECT id FROM survey_assignment WHERE "assigneeId" = ${user!.id})
    OR ${t}.id IN (SELECT p."houseId" FROM house_plate p JOIN install_assignment ia ON ia.id = p."installAssignmentId" WHERE ia."assigneeId" = ${user!.id})`;
  return hamletId
    ? Prisma.sql`AND (${t}."hamletId" = ${hamletId} OR ${assigned})`
    : Prisma.sql`AND (${assigned})`;
}

/** Ném 404 (không phải 403) để không lộ nhà ngoài phạm vi có tồn tại hay không. */
export const OUT_OF_SCOPE_HOUSE = 'Không tìm thấy hồ sơ số nhà';

/**
 * Nhà mà cán bộ ấp TẠO MỚI hoặc CHUYỂN TỚI phải thuộc ấp của họ — trừ khi nhà gắn với nhiệm vụ khảo sát
 * của chính họ (nhiệm vụ do xã giao có thể nằm ở ấp khác). Trả về ấp sẽ ghi: bỏ trống thì lấy ấp của họ.
 */
export function resolveHamletForWrite(
  user: ScopeUser,
  requestedHamletId: string | null | undefined,
  inOwnAssignment: boolean,
): string | null | undefined {
  const hamletId = scopedHamletId(user);
  if (hamletId === undefined || inOwnAssignment) return requestedHamletId;
  if (!hamletId) throw new ForbiddenException('Tài khoản chưa được gán ấp/thôn — liên hệ quản trị viên');
  if (requestedHamletId === undefined || requestedHamletId === null) return hamletId;
  if (requestedHamletId !== hamletId) {
    throw new ForbiddenException('Nhân sự ấp/thôn chỉ được ghi nhận nhà trong ấp/thôn của mình');
  }
  return hamletId;
}
