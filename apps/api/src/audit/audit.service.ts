import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  userId?: string | null;
  method: string;
  path: string;
  action: string;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry) {
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        method: entry.method,
        path: entry.path,
        action: entry.action,
        ip: entry.ip ?? null,
        metadata: (entry.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }
}
