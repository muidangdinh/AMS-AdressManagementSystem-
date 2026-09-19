import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Giá trị mặc định khi `AppSetting` chưa được seed (an toàn cho môi trường mới). */
const DEFAULTS = {
  'province.name': 'Tỉnh Tây Ninh',
  'app.shortName': 'AMS',
};

/**
 * Đọc các hằng số toàn hệ thống (KHÔNG phải theo người dùng — xem
 * `apps/mobile/src/lib/workingWard.ts` cho ngữ cảnh "xã đang làm việc",
 * đó là theo người dùng nên không đặt ở đây) từ bảng `AppSetting` (có sẵn
 * từ Phase 0, trước đây không dùng tới). Chỉ 2 khoá: tên tỉnh và tên viết
 * tắt ứng dụng — theo góp ý khách hàng 11/09/2026 (đổi thương hiệu "AMS").
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicConfig() {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: Object.keys(DEFAULTS) } },
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));

    return {
      provinceName: byKey.get('province.name') ?? DEFAULTS['province.name'],
      appShortName: byKey.get('app.shortName') ?? DEFAULTS['app.shortName'],
    };
  }
}
