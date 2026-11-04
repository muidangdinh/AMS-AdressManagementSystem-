import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DepartmentLevel, Prisma, UserLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { ListDepartmentsQueryDto } from './dto/list-departments-query.dto';

const DEPARTMENT_INCLUDE = {
  ward: { select: { id: true, name: true } },
  hamlet: { select: { id: true, name: true } },
  _count: { select: { users: true } },
} as const;

/** Chuẩn hóa tên để so trùng: bỏ khoảng trắng thừa — khớp cách migration gộp các giá trị `unit` cũ. */
const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ');

type Scope = { level: DepartmentLevel; wardId: string; hamletId: string | null };

/**
 * Danh mục phòng ban — chỉ để chọn/lọc người dùng, không ảnh hưởng quyền hay phạm vi dữ liệu.
 * Phòng ban thuộc UBND một xã (WARD) hoặc một ấp/thôn (HAMLET); không còn cấp tỉnh. Phòng ban cấp tỉnh cũ
 * (level null) chỉ còn để admin phân cấp lại hoặc xóa.
 * Khi người dùng được gán phòng ban, cột `User.unit` ghi theo tên phòng ban (lời chào dashboard mobile
 * và APK cũ vẫn đọc `unit`), nên đổi tên phòng ban phải cập nhật `unit` của mọi nhân sự trong đó.
 */
@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListDepartmentsQueryDto) {
    const search = query.search?.trim();
    return this.prisma.department.findMany({
      where: {
        AND: [
          query.level === 'UNSET' ? { level: null } : query.level ? { level: query.level } : {},
          query.wardId ? { wardId: query.wardId } : {},
          query.hamletId ? { hamletId: query.hamletId } : {},
          query.activeOnly === 'true' ? { isActive: true } : {},
          search ? { name: { contains: search, mode: 'insensitive' } } : {},
        ],
      },
      include: DEPARTMENT_INCLUDE,
      // Chưa phân cấp lên đầu để admin thấy việc cần làm; sau đó cấp xã, rồi cấp ấp.
      orderBy: [{ level: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const d = await this.prisma.department.findUnique({ where: { id }, include: DEPARTMENT_INCLUDE });
    if (!d) throw new NotFoundException('Không tìm thấy phòng ban');
    return d;
  }

  /** Cấp xã bắt buộc xã; cấp ấp bắt buộc ấp, xã tự lấy theo ấp (gửi kèm xã khác thì báo lỗi). */
  private async resolveScope(level: DepartmentLevel, wardId?: string | null, hamletId?: string | null): Promise<Scope> {
    if (level === DepartmentLevel.WARD) {
      if (!wardId) throw new BadRequestException('Phòng ban cấp xã phải chọn xã/phường');
      const ward = await this.prisma.ward.findUnique({ where: { id: wardId }, select: { id: true } });
      if (!ward) throw new BadRequestException('Xã/phường không tồn tại');
      return { level, wardId, hamletId: null };
    }
    if (!hamletId) throw new BadRequestException('Phòng ban cấp ấp/thôn phải chọn ấp/thôn');
    const hamlet = await this.prisma.hamlet.findUnique({ where: { id: hamletId }, select: { wardId: true } });
    if (!hamlet) throw new BadRequestException('Ấp/thôn không tồn tại');
    if (wardId && wardId !== hamlet.wardId) throw new BadRequestException('Ấp/thôn không thuộc xã/phường đã chọn');
    return { level, wardId: hamlet.wardId, hamletId };
  }

  /** Không cho 2 phòng ban cùng tên (không phân biệt hoa/thường) trong cùng xã (cấp xã) hoặc cùng ấp. */
  private async assertNameAvailable(name: string, scope: Scope, exceptId?: string) {
    const dup = await this.prisma.department.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        level: scope.level,
        wardId: scope.wardId,
        hamletId: scope.hamletId,
        ...(exceptId && { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException(
        scope.level === DepartmentLevel.WARD ? 'Xã/phường này đã có phòng ban cùng tên' : 'Ấp/thôn này đã có phòng ban cùng tên',
      );
    }
  }

  /** Điều kiện nhân sự KHÔNG khớp phạm vi phòng ban (cấp xã ↔ nhân sự UBND cùng xã; cấp ấp ↔ nhân sự cùng ấp). */
  private mismatchedMembers(scope: Scope): Prisma.UserWhereInput {
    return scope.level === DepartmentLevel.WARD
      ? { NOT: { level: UserLevel.WARD, wardId: scope.wardId } }
      : { NOT: { level: UserLevel.HAMLET, hamletId: scope.hamletId } };
  }

  async create(dto: CreateDepartmentDto) {
    const name = normalizeName(dto.name);
    if (!name) throw new BadRequestException('Tên phòng ban không được để trống');
    const scope = await this.resolveScope(dto.level, dto.wardId, dto.hamletId);
    await this.assertNameAvailable(name, scope);
    return this.prisma.department.create({ data: { name, ...scope }, include: DEPARTMENT_INCLUDE });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const current = await this.findOne(id);
    const name = dto.name !== undefined ? normalizeName(dto.name) : current.name;
    if (!name) throw new BadRequestException('Tên phòng ban không được để trống');

    // Đổi cấp/xã/ấp (kể cả phân cấp cho phòng ban cũ chưa có cấp). Trường không gửi thì giữ như cũ.
    let scope: Scope | null = null;
    const touchesScope = dto.level !== undefined || dto.wardId !== undefined || dto.hamletId !== undefined;
    if (touchesScope) {
      const level = dto.level ?? current.level;
      if (!level) throw new BadRequestException('Chọn cấp cho phòng ban: cấp xã hoặc cấp ấp/thôn');
      const sameLevel = level === current.level;
      scope = await this.resolveScope(
        level,
        dto.wardId !== undefined ? dto.wardId : sameLevel ? current.wardId : null,
        dto.hamletId !== undefined ? dto.hamletId : sameLevel ? current.hamletId : null,
      );
    } else if (current.level) {
      scope = { level: current.level, wardId: current.wardId!, hamletId: current.hamletId };
    }
    const scopeChanged =
      !!scope &&
      (scope.level !== current.level || scope.wardId !== current.wardId || scope.hamletId !== current.hamletId);

    // Phạm vi mới phải chứa được mọi nhân sự đang thuộc phòng ban.
    if (scope && scopeChanged) {
      const mismatched = await this.prisma.user.count({ where: { departmentId: id, ...this.mismatchedMembers(scope) } });
      if (mismatched > 0) {
        throw new ConflictException(
          `Có ${mismatched} nhân sự của phòng ban không thuộc ${
            scope.level === DepartmentLevel.WARD ? 'UBND xã/phường' : 'ấp/thôn'
          } này — chuyển họ sang phòng ban khác trước`,
        );
      }
    }
    if (scope && (scopeChanged || name.toLowerCase() !== current.name.toLowerCase())) {
      await this.assertNameAvailable(name, scope, id);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.department.update({
        where: { id },
        data: { name, isActive: dto.isActive, ...(scope && scopeChanged ? scope : {}) },
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
