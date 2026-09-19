import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NumberingSchemeStatus, NumberingSide, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchemeDto } from './dto/create-scheme.dto';
import { UpdateSchemeDto } from './dto/update-scheme.dto';
import { ListSchemesQueryDto } from './dto/list-schemes-query.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { RejectSchemeDto } from './dto/reject-scheme.dto';

const SCHEME_INCLUDE = {
  street: { select: { id: true, name: true } },
  ward: { select: { id: true, name: true } },
  createdBy: { select: { id: true, fullName: true, username: true } },
  approvedBy: { select: { id: true, fullName: true, username: true } },
} satisfies Prisma.NumberingSchemeInclude;

const ITEM_INCLUDE = {
  house: {
    select: {
      id: true,
      houseNumber: true,
      street: true,
      ward: true,
      ownerName: true,
      latitude: true,
      longitude: true,
      status: true,
      streetId: true,
    },
  },
} satisfies Prisma.NumberingSchemeItemInclude;

export interface SchemeValidationResult {
  duplicateNumbers: { number: string; itemIds: string[] }[];
  duplicateOrders: { side: NumberingSide; order: number; itemIds: string[] }[];
  wrongStreetItemIds: string[];
  missingNumberItemIds: string[];
}

/**
 * Lập phương án đánh số (Phase 7 — V. Đánh số nhà). Vòng đời:
 * DRAFT → (sửa/thêm nhà/sinh số) → SUBMITTED → APPROVED (ghi vào House +
 * HouseHistory, coi như khoá) hoặc REJECTED (sửa lại → quay về DRAFT).
 */
@Injectable()
export class NumberingSchemesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListSchemesQueryDto) {
    return this.prisma.numberingScheme.findMany({
      where: {
        streetId: query.streetId,
        status: query.status,
      },
      include: SCHEME_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const scheme = await this.prisma.numberingScheme.findUnique({
      where: { id },
      include: {
        ...SCHEME_INCLUDE,
        items: { include: ITEM_INCLUDE, orderBy: [{ side: 'asc' }, { sequenceOrder: 'asc' }] },
      },
    });
    if (!scheme) throw new NotFoundException('Không tìm thấy phương án đánh số');
    return scheme;
  }

  private async findOneOrThrow(id: string) {
    const scheme = await this.prisma.numberingScheme.findUnique({ where: { id } });
    if (!scheme) throw new NotFoundException('Không tìm thấy phương án đánh số');
    return scheme;
  }

  private assertEditable(status: NumberingSchemeStatus) {
    if (status !== NumberingSchemeStatus.DRAFT && status !== NumberingSchemeStatus.REJECTED) {
      throw new ConflictException('Chỉ sửa được phương án ở trạng thái Nháp hoặc Bị từ chối');
    }
  }

  async create(dto: CreateSchemeDto, userId: string) {
    const street = await this.prisma.street.findUnique({ where: { id: dto.streetId } });
    if (!street) throw new NotFoundException('Không tìm thấy đường/phố');

    const oddEvenSplit = dto.oddEvenSplit ?? true;
    return this.prisma.numberingScheme.create({
      data: {
        name: dto.name,
        streetId: dto.streetId,
        wardId: street.wardId,
        description: dto.description,
        oddEvenSplit,
        startNumber: dto.startNumber ?? 1,
        step: dto.step ?? (oddEvenSplit ? 2 : 1),
        createdById: userId,
      },
      include: SCHEME_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateSchemeDto) {
    const scheme = await this.findOneOrThrow(id);
    this.assertEditable(scheme.status);

    const wasRejected = scheme.status === NumberingSchemeStatus.REJECTED;
    return this.prisma.numberingScheme.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        oddEvenSplit: dto.oddEvenSplit,
        startNumber: dto.startNumber,
        step: dto.step,
        // Sửa lại 1 phương án bị từ chối = soạn lại — quay về DRAFT, xoá lý do từ chối cũ.
        status: wasRejected ? NumberingSchemeStatus.DRAFT : undefined,
        rejectedReason: wasRejected ? null : undefined,
      },
      include: SCHEME_INCLUDE,
    });
  }

  async remove(id: string) {
    const scheme = await this.findOneOrThrow(id);
    if (scheme.status !== NumberingSchemeStatus.DRAFT) {
      throw new ConflictException('Chỉ xóa được phương án ở trạng thái Nháp');
    }
    await this.prisma.numberingScheme.delete({ where: { id } });
  }

  // ---- Nhà trong phương án ----

  async addItem(schemeId: string, dto: CreateItemDto) {
    const scheme = await this.findOneOrThrow(schemeId);
    this.assertEditable(scheme.status);

    const house = await this.prisma.house.findUnique({ where: { id: dto.houseId } });
    if (!house) throw new NotFoundException('Không tìm thấy hồ sơ số nhà');

    const side = dto.side ?? NumberingSide.NONE;

    let sequenceOrder = dto.sequenceOrder;
    if (sequenceOrder === undefined) {
      const last = await this.prisma.numberingSchemeItem.findFirst({
        where: { schemeId, side },
        orderBy: { sequenceOrder: 'desc' },
      });
      sequenceOrder = (last?.sequenceOrder ?? 0) + 1;
    }

    try {
      return await this.prisma.numberingSchemeItem.create({
        data: { schemeId, houseId: dto.houseId, side, sequenceOrder },
        include: ITEM_INCLUDE,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Nhà này đã có trong phương án');
      }
      throw err;
    }
  }

  async updateItem(schemeId: string, itemId: string, dto: UpdateItemDto) {
    const scheme = await this.findOneOrThrow(schemeId);
    this.assertEditable(scheme.status);

    const item = await this.prisma.numberingSchemeItem.findUnique({ where: { id: itemId } });
    if (!item || item.schemeId !== schemeId) {
      throw new NotFoundException('Không tìm thấy nhà trong phương án');
    }

    return this.prisma.numberingSchemeItem.update({
      where: { id: itemId },
      data: dto,
      include: ITEM_INCLUDE,
    });
  }

  async removeItem(schemeId: string, itemId: string) {
    const scheme = await this.findOneOrThrow(schemeId);
    this.assertEditable(scheme.status);

    const item = await this.prisma.numberingSchemeItem.findUnique({ where: { id: itemId } });
    if (!item || item.schemeId !== schemeId) {
      throw new NotFoundException('Không tìm thấy nhà trong phương án');
    }

    await this.prisma.numberingSchemeItem.delete({ where: { id: itemId } });
  }

  // ---- Sinh số tự động & kiểm tra (5.2, 5.3) ----

  /** Sinh proposedNumber cho toàn bộ item theo quy tắc phương án — ghi đè giá trị cũ (kể cả đã sửa tay). */
  async generate(schemeId: string) {
    const scheme = await this.findOneOrThrow(schemeId);
    this.assertEditable(scheme.status);

    const items = await this.prisma.numberingSchemeItem.findMany({ where: { schemeId } });
    const updates: { id: string; proposedNumber: string }[] = [];

    if (scheme.oddEvenSplit) {
      const oddStart = scheme.startNumber % 2 === 1 ? scheme.startNumber : scheme.startNumber + 1;
      const evenStart = scheme.startNumber % 2 === 0 ? scheme.startNumber : scheme.startNumber + 1;
      const sides: [NumberingSide, number][] = [
        [NumberingSide.ODD, oddStart],
        [NumberingSide.EVEN, evenStart],
      ];
      for (const [side, start] of sides) {
        const sideItems = items
          .filter((i) => i.side === side)
          .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
        sideItems.forEach((item, index) => {
          updates.push({ id: item.id, proposedNumber: String(start + index * scheme.step) });
        });
      }
      // side=NONE không được sinh số khi phương án tách chẵn/lẻ — validate() sẽ báo thiếu,
      // nhắc cán bộ gán bên (lẻ/chẵn) cho nhà đó trước khi trình duyệt.
    } else {
      const sorted = [...items].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      sorted.forEach((item, index) => {
        updates.push({ id: item.id, proposedNumber: String(scheme.startNumber + index * scheme.step) });
      });
    }

    await this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.numberingSchemeItem.update({
          where: { id: u.id },
          data: { proposedNumber: u.proposedNumber },
        }),
      ),
    );

    return this.findOne(schemeId);
  }

  /** Kiểm tra phương án (5.3): số trùng, thứ tự trùng, sai tuyến, chưa có số. */
  async validate(schemeId: string): Promise<SchemeValidationResult> {
    const scheme = await this.findOneOrThrow(schemeId);
    const items = await this.prisma.numberingSchemeItem.findMany({
      where: { schemeId },
      include: { house: { select: { streetId: true } } },
    });

    const numberMap = new Map<string, string[]>();
    const orderMap = new Map<string, string[]>();
    const wrongStreetItemIds: string[] = [];
    const missingNumberItemIds: string[] = [];

    for (const item of items) {
      if (item.house.streetId !== scheme.streetId) wrongStreetItemIds.push(item.id);

      if (!item.proposedNumber) {
        missingNumberItemIds.push(item.id);
      } else {
        const arr = numberMap.get(item.proposedNumber) ?? [];
        arr.push(item.id);
        numberMap.set(item.proposedNumber, arr);
      }

      const orderKey = `${item.side}:${item.sequenceOrder}`;
      const oarr = orderMap.get(orderKey) ?? [];
      oarr.push(item.id);
      orderMap.set(orderKey, oarr);
    }

    const duplicateNumbers = [...numberMap.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([number, itemIds]) => ({ number, itemIds }));

    const duplicateOrders = [...orderMap.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([key, itemIds]) => {
        const [side, order] = key.split(':');
        return { side: side as NumberingSide, order: Number(order), itemIds };
      });

    return { duplicateNumbers, duplicateOrders, wrongStreetItemIds, missingNumberItemIds };
  }

  // ---- Quy trình phê duyệt (5.4) ----

  async submit(schemeId: string) {
    const scheme = await this.findOneOrThrow(schemeId);
    if (
      scheme.status !== NumberingSchemeStatus.DRAFT &&
      scheme.status !== NumberingSchemeStatus.REJECTED
    ) {
      throw new ConflictException('Chỉ trình duyệt được phương án ở trạng thái Nháp hoặc Bị từ chối');
    }

    const itemCount = await this.prisma.numberingSchemeItem.count({ where: { schemeId } });
    if (itemCount === 0) throw new BadRequestException('Phương án chưa có nhà nào');

    const validation = await this.validate(schemeId);
    if (validation.duplicateNumbers.length > 0 || validation.missingNumberItemIds.length > 0) {
      throw new BadRequestException(
        'Còn số trùng hoặc chưa sinh số cho tất cả nhà — kiểm tra lại trước khi trình duyệt',
      );
    }

    return this.prisma.numberingScheme.update({
      where: { id: schemeId },
      data: { status: NumberingSchemeStatus.SUBMITTED, submittedAt: new Date(), rejectedReason: null },
      include: SCHEME_INCLUDE,
    });
  }

  /** Phê duyệt: ghi proposedNumber vào House.houseNumber hàng loạt (transaction) + lưu HouseHistory. */
  async approve(schemeId: string, userId: string) {
    const scheme = await this.findOneOrThrow(schemeId);
    if (scheme.status !== NumberingSchemeStatus.SUBMITTED) {
      throw new ConflictException('Chỉ phê duyệt được phương án đang Chờ duyệt');
    }

    const items = await this.prisma.numberingSchemeItem.findMany({
      where: { schemeId },
      include: { house: { select: { id: true, houseNumber: true } } },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (!item.proposedNumber || item.proposedNumber === item.house.houseNumber) continue;

        const oldNumber = item.house.houseNumber;
        await tx.house.update({
          where: { id: item.houseId },
          data: { houseNumber: item.proposedNumber },
        });
        await tx.houseHistory.create({
          data: {
            houseId: item.houseId,
            action: 'UPDATE',
            changes: [
              { field: 'houseNumber', old: oldNumber, new: item.proposedNumber },
            ] as unknown as Prisma.InputJsonValue,
            changedById: userId,
          },
        });
      }

      await tx.numberingScheme.update({
        where: { id: schemeId },
        data: {
          status: NumberingSchemeStatus.APPROVED,
          approvedById: userId,
          approvedAt: new Date(),
        },
      });
    });

    return this.findOne(schemeId);
  }

  async reject(schemeId: string, dto: RejectSchemeDto) {
    const scheme = await this.findOneOrThrow(schemeId);
    if (scheme.status !== NumberingSchemeStatus.SUBMITTED) {
      throw new ConflictException('Chỉ từ chối được phương án đang Chờ duyệt');
    }

    return this.prisma.numberingScheme.update({
      where: { id: schemeId },
      data: { status: NumberingSchemeStatus.REJECTED, rejectedReason: dto.reason },
      include: SCHEME_INCLUDE,
    });
  }
}
