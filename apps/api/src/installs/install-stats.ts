import { PlateStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Số biển của 1 nhiệm vụ theo từng kết quả hiện trường. */
export interface PlateStats {
  total: number;
  /** Đã gắn. */
  installed: number;
  /** Chưa xử lý (đã cấp, chưa gắn, chưa ghi nhận lý do). */
  pending: number;
  /** Chưa gắn được — đã ghi lý do. */
  notInstalled: number;
  /** Còn cờ "thi công lại" chưa xử lý. */
  revisit: number;
}

const EMPTY: PlateStats = { total: 0, installed: 0, pending: 0, notInstalled: 0, revisit: 0 };

/** Thống kê biển cho nhiều nhiệm vụ bằng ĐÚNG 1 truy vấn. Biển đã thu hồi không tính. */
export async function plateStatsFor(
  prisma: PrismaService,
  assignmentIds: string[],
): Promise<Map<string, PlateStats>> {
  const map = new Map<string, PlateStats>();
  if (assignmentIds.length === 0) return map;
  const plates = await prisma.housePlate.findMany({
    where: { installAssignmentId: { in: assignmentIds }, status: { not: PlateStatus.REVOKED } },
    select: { installAssignmentId: true, status: true, notInstalledAt: true, revisitReason: true },
  });
  for (const p of plates) {
    const key = p.installAssignmentId as string;
    const st = map.get(key) ?? { ...EMPTY };
    st.total += 1;
    if (p.status === PlateStatus.INSTALLED) st.installed += 1;
    else if (p.notInstalledAt) st.notInstalled += 1;
    else st.pending += 1;
    if (p.revisitReason) st.revisit += 1;
    map.set(key, st);
  }
  return map;
}

export function statsOrEmpty(map: Map<string, PlateStats>, id: string): PlateStats {
  return map.get(id) ?? { ...EMPTY };
}
