import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { ListDepartmentsQueryDto } from './dto/list-departments-query.dto';

const DEPARTMENT_INCLUDE = {
  ward: { select: { id: true, name: true } },
  _count: { select: { users: true } },
} as const;

/** Chuẩn hóa tên để so trùng: bỏ khoảng trắng thừa — khớp cách migration gộp các giá trị `unit` cũ. */
const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ');

/**
 * Danh mục phòng ban — chỉ để chọn/lọc người dùng, không ảnh hưởng quyền hay phạm vi dữ liệu.
 * Khi người dùng được gán phòng ban, cột `User.unit` ghi theo tên phòng ban (lời chào dashboard mobile
 * và APK cũ vẫn đọc `unit`), nên đổi tên phòng ban phải cập nhật `unit` của mọi nhân sự trong đó.
 */
@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListDepartmentsQueryDto) {
    const search = query.search?.trim();
    const wardFilter: Prisma.DepartmentWhereInput =
      query.wardId === 'province'
        ? { wardId: null }
        : query.wardId
          ? query.includeProvince === 'true'
            ? { OR: [{ wardId: query.wardId }, { wardId: null }] }
            : { wardId: query.wardId }
          : {};
    return this.prisma.department.findMany({
      where: {
        AND: [
          wardFilter,
          query.activeOnly === 'true' ? { isActive: true } : {},
          search ? { name: { contains: search, mode: 'insensitive' } } : {},
        ],
      },
      include: DEPARTMENT_INCLUDE,
      orderBy: [{ wardId: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const d = await this.prisma.department.findUnique({ where: { id }, include: DEPARTMENT_INCLUDE });
    if (!d) throw new NotFoundException('Không tìm thấy phòng ban');
    return d;
  }

  private async assertWardExists(wardId: string) {
    const ward = await this.prisma.ward.findUnique({ where: { id: wardId }, select: { id: true } });
    if (!ward) throw new BadRequestException('Xã/phường không tồn tại');
  }

  /** Không cho 2 phòng ban cùng tên (không phân biệt hoa/thường) trong cùng phạm vi (cùng xã, hoặc cấp tỉnh). */
  private async assertNameAvailable(name: string, wardId: string | null, exceptId?: string) {
    const dup = await this.prisma.department.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        wardId,
        ...(exceptId && { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException(
        wardId ? 'Xã/phường này đã có phòng ban cùng tên' : 'Đã có phòng ban cấp tỉnh cùng tên',
      );
    }
  }

  async create(dto: CreateDepartmentDto) {
    const name = normalizeName(dto.name);
    if (!name) throw new BadRequestException('Tên phòng ban không được để trống');
    const wardId = dto.wardId || null;
    if (wardId) await this.assertWardExists(wardId);
    await this.assertNameAvailable(name, wardId);
    return this.prisma.department.create({ data: { name, wardId }, include: DEPARTMENT_INCLUDE });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const current = await this.findOne(id);
    const name = dto.name !== undefined ? normalizeName(dto.name) : current.name;
    if (!name) throw new BadRequestException('Tên phòng ban không được để trống');
    const wardId = dto.wardId !== undefined ? dto.wardId || null : current.wardId;

    if (wardId !== current.wardId) {
      if (wardId) await this.assertWardExists(wardId);
      // Chuyển sang xã khác: mọi nhân sự đang gán phải thuộc xã đó (tài khoản hệ thống không có xã).
      if (wardId) {
        const mismatched = await this.prisma.user.count({
          where: { departmentId: id, OR: [{ wardId: null }, { wardId: { not: wardId } }] },
        });
        if (mismatched > 0) {
          throw new ConflictException(
            `Có ${mismatched} nhân sự của phòng ban không thuộc xã/phường này — chuyển họ sang phòng ban khác trước`,
          );
        }
      }
    }
    if (name.toLowerCase() !== current.name.toLowerCase() || wardId !== current.wardId) {
      await this.assertNameAvailable(name, wardId, id);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.department.update({
        where: { id },
        data: { name, wardId, isActive: dto.isActive },
        include: DEPARTMENT_INCLUDE,
      });
      if (name !== current.name) {
        await tx.user.updateMany({ where: { departmentId: id }, data: { unit: name } });
      }
      return updated;
    });
  }

  /** Còn nhân sự thì không xóa (chỉ ngừng sử dụng) — tránh âm thầm làm mất thông tin đơn vị của họ. */
  async remove(id: string) {
    const d = await this.findOne(id);
    if (d._count.users > 0) {
      throw new ConflictException(
        `Phòng ban đang có ${d._count.users} nhân sự — chuyển họ sang phòng ban khác hoặc chọn "Ngừng sử dụng"`,
      );
    }
    await this.prisma.department.delete({ where: { id } });
  }
}
