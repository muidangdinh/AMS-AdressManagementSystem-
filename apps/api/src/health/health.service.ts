import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * HealthService kiểm tra "sức khỏe" toàn tuyến: API sống + DB + PostGIS.
 */
@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check() {
    let dbOk = false;
    let postgisVersion: string | null = null;
    let error: string | null = null;

    try {
      // Truy vấn thô để xác minh DB phản hồi và PostGIS đã bật
      const rows = await this.prisma.$queryRawUnsafe<{ postgis: string }[]>(
        'SELECT postgis_full_version() AS postgis',
      );
      postgisVersion = rows?.[0]?.postgis ?? null;
      dbOk = true;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    return {
      status: dbOk ? 'ok' : 'degraded',
      service: 'tayninh-gis-api',
      timestamp: new Date().toISOString(),
      checks: {
        api: 'up',
        database: dbOk ? 'up' : 'down',
        postgis: postgisVersion ? 'enabled' : 'unknown',
      },
      postgisVersion,
      error,
    };
  }
}
