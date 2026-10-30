import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { getBrandingDir } from '../config/upload.config';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMapSettingsDto } from './dto/update-map-settings.dto';

/** Giá trị mặc định khi `AppSetting` chưa được seed (an toàn cho môi trường mới). */
const DEFAULTS = {
  'province.name': 'Tỉnh Tây Ninh',
  'app.shortName': 'AMS',
};

const LOGO_KEYS = {
  'web-light': 'branding.webLogoLight',
  'web-dark': 'branding.webLogoDark',
  app: 'branding.appLogo',
} as const;

export type BrandLogoKind = keyof typeof LOGO_KEYS;
const BRANDING_URL_PREFIX = '/uploads/branding/';

/**
 * Cấu hình bản đồ (web — trang Hệ thống → Cấu hình bản đồ). `map.hidePoi` = ẩn lớp icon địa điểm
 * của nền bản đồ (nhà hàng, cửa hàng, cây xăng…) để chỉ còn marker số nhà của hệ thống; chưa từng
 * lưu → mặc định ẩn. Lưu dạng chuỗi "true"/"false" vì `AppSetting.value` là text.
 */
const MAP_KEYS = {
  hidePoi: 'map.hidePoi',
} as const;
const MAP_DEFAULTS = { hidePoi: true };

/**
 * Đọc các hằng số toàn hệ thống (KHÔNG phải theo người dùng — xem
 * `apps/mobile/src/lib/workingWard.ts` cho ngữ cảnh "xã đang làm việc",
 * đó là theo người dùng nên không đặt ở đây) từ bảng `AppSetting` (có sẵn
 * từ Phase 0, trước đây không dùng tới). Ngoài tên tỉnh/tên viết tắt, ba
 * khoá logo cho phép admin thay logo header web (sáng/tối) và header app.
 */
@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPublicConfig() {
    const keys = [...Object.keys(DEFAULTS), ...Object.values(LOGO_KEYS), ...Object.values(MAP_KEYS)];
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: keys } },
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));

    return {
      provinceName: byKey.get('province.name') ?? DEFAULTS['province.name'],
      appShortName: byKey.get('app.shortName') ?? DEFAULTS['app.shortName'],
      webLogoLightUrl: byKey.get(LOGO_KEYS['web-light']) ?? null,
      webLogoDarkUrl: byKey.get(LOGO_KEYS['web-dark']) ?? null,
      appLogoUrl: byKey.get(LOGO_KEYS.app) ?? null,
      mapHidePoi: parseBool(byKey.get(MAP_KEYS.hidePoi), MAP_DEFAULTS.hidePoi),
    };
  }

  async setMapSettings(dto: UpdateMapSettingsDto) {
    if (dto.hidePoi !== undefined) {
      const value = String(dto.hidePoi);
      await this.prisma.appSetting.upsert({
        where: { key: MAP_KEYS.hidePoi },
        update: { value },
        create: { key: MAP_KEYS.hidePoi, value },
      });
    }
    return this.getPublicConfig();
  }

  async setLogo(kind: string, file?: Express.Multer.File) {
    const logoKind = this.parseKind(kind);
    if (!file) throw new BadRequestException('Vui lòng chọn file logo');

    const key = LOGO_KEYS[logoKind];
    const old = await this.prisma.appSetting.findUnique({ where: { key } });
    const url = `${BRANDING_URL_PREFIX}${file.filename}`;

    try {
      await this.prisma.appSetting.upsert({
        where: { key },
        update: { value: url },
        create: { key, value: url },
      });
    } catch (err) {
      await this.removeFile(url);
      throw err;
    }

    await this.removeFile(old?.value);
    return this.getPublicConfig();
  }

  private parseKind(kind: string): BrandLogoKind {
    if (kind !== 'web-light' && kind !== 'web-dark' && kind !== 'app') {
      throw new BadRequestException('Loại logo không hợp lệ');
    }
    return kind;
  }

  private async removeFile(url?: string | null) {
    if (!url?.startsWith(BRANDING_URL_PREFIX)) return;

    const filePath = path.join(getBrandingDir(), path.basename(url));
    try {
      await fs.promises.unlink(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Không xóa được logo cũ: ${filePath}`);
      }
    }
  }
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}
