import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService: quản lý kết nối tới PostgreSQL/PostGIS.
 * Được inject vào các module nghiệp vụ ở những phase sau.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Đã kết nối PostgreSQL/PostGIS');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Đã đóng kết nối PostgreSQL');
  }
}
