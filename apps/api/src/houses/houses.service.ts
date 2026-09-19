import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import * as ExcelJS from 'exceljs';
import {
  BuildingType,
  House,
  HouseStatus,
  HouseUsageStatus,
  PlateNeed,
  NumberingSide,
  HouseReviewStage,
  PhotoType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getUploadRoot } from '../config/upload.config';
import { CreateHouseDto } from './dto/create-house.dto';
import { UpdateHouseDto } from './dto/update-house.dto';
import { ListHousesQueryDto } from './dto/list-houses-query.dto';
import { GeoJsonQueryDto } from './dto/geojson-query.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';

const HISTORY_PAGE_SIZE = 20;
/** Giới hạn an toàn cho lớp bản đồ — tránh tải toàn bộ CSDL nếu không lọc. */
const MAX_GEOJSON_FEATURES = 2000;
/** Giới hạn an toàn cho xuất Excel — tránh tải toàn bộ CSDL nếu không lọc. */
const MAX_EXPORT_ROWS = 5000;

/**
 * Nhãn tiếng Việt cho xuất Excel — định nghĩa cục bộ (không import
 * @tayninh/shared) vì package đó trỏ thẳng vào TS nguồn (main: src/index.ts);
 * Next.js transpile được qua bundler riêng, nhưng NestJS chạy `node dist/main.js`
 * thuần thì Node cố strip-type trực tiếp file .ts và lỗi ngay ở cú pháp `enum`
 * (có hành vi runtime, không chỉ là type). Hai bảng nhãn này nhỏ, bám sát enum
 * Prisma, khớp 1:1 với packages/shared/src/index.ts — nếu enum đổi thì sửa cả 2 nơi.
 */
const BUILDING_TYPE_LABELS_VI: Record<BuildingType, string> = {
  SINGLE_HOUSE: 'Nhà ở riêng lẻ',
  SHOP: 'Cửa hàng kinh doanh',
  OFFICE_BUILDING: 'Tòa nhà văn phòng',
  APARTMENT: 'Nhà chung cư',
  COMPANY_FACTORY: 'Công ty/Nhà máy',
  RESIDENTIAL_AREA: 'Khu dân cư',
};

const HOUSE_STATUS_LABELS_VI: Record<HouseStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã cấp biển & QR',
  NEEDS_ADJUST: 'Cần hiệu chỉnh',
};

const HOUSE_USAGE_STATUS_LABELS_VI: Record<HouseUsageStatus, string> = {
  RESIDENTIAL: 'Nhà ở',
  VACANT: 'Bỏ trống',
  UNDER_CONSTRUCTION: 'Đang xây dựng',
  BUSINESS: 'Kinh doanh / cho thuê',
};

const PLATE_NEED_LABELS_VI: Record<PlateNeed, string> = {
  NEEDED: 'Có nhu cầu',
  NOT_NEEDED: 'Không có nhu cầu',
  ALREADY_HAS: 'Đã có biển',
};

const NUMBERING_SIDE_LABELS_VI: Record<NumberingSide, string> = {
  ODD: 'Bên lẻ',
  EVEN: 'Bên chẵn',
  NONE: 'Không phân biệt',
};

const HOUSE_REVIEW_STAGE_LABELS_VI: Record<HouseReviewStage, string> = {
  PROPOSED: 'Đề xuất',
  CHECKED: 'Đã kiểm tra',
  APPROVED: 'Đã duyệt',
  SIGNED: 'Đã ký duyệt',
  REJECTED: 'Từ chối',
};

/** Hàng trả về từ truy vấn ST_DWithin (raw SQL) — House + khoảng cách (mét). */
interface NearbyRow {
  id: string;
  houseNumber: string;
  street: string;
  ward: string;
  district: string | null;
  ownerName: string;
  ownerPhone: string | null;
  ownerIdNumber: string | null;
  buildingType: string;
  floors: number | null;
  area: number | null;
  status: string;
  qrCode: string;
  latitude: number;
  longitude: number;
  soTo: string | null;
  soThua: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  distance: number;
}

/**
 * Phase 6 — kèm tên danh mục địa chỉ chuẩn hoá (nếu House đã gán) vào response,
 * để FE hiển thị/điền sẵn dropdown mà không cần gọi thêm request riêng.
 */
const ADDRESS_CATALOG_INCLUDE = {
  districtRef: { select: { id: true, name: true } },
  wardRef: { select: { id: true, name: true } },
  hamlet: { select: { id: true, name: true } },
  streetRef: { select: { id: true, name: true } },
  alley: { select: { id: true, name: true } },
} satisfies Prisma.HouseInclude;

/** Các field cho phép so sánh để ghi lịch sử khi update. */
const TRACKED_FIELDS: (keyof UpdateHouseDto)[] = [
  'houseNumber',
  'street',
  'ward',
  'district',
  'wardId',
  'hamletId',
  'streetId',
  'alleyId',
  'districtId',
  'ownerName',
  'ownerPhone',
  'ownerIdNumber',
  'buildingType',
  'floors',
  'area',
  'status',
  'latitude',
  'longitude',
  'soTo',
  'soThua',
  'usageStatus',
  'plateNeed',
  'side',
  'reviewStage',
  'note',
];

@Injectable()
export class HousesService {
  private readonly logger = new Logger(HousesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Xây where-clause dùng chung cho danh sách phân trang và lớp GeoJSON bản đồ. */
  private buildWhere(filter: {
    street?: string;
    ward?: string;
    wardId?: string;
    streetId?: string;
    hamletId?: string;
    status?: Prisma.HouseWhereInput['status'];
    reviewStage?: Prisma.HouseWhereInput['reviewStage'];
    search?: string;
    createdById?: string;
  }): Prisma.HouseWhereInput {
    const { street, ward, wardId, streetId, hamletId, status, reviewStage, search, createdById } = filter;
    return {
      ...(street && { street: { contains: street, mode: 'insensitive' } }),
      ...(ward && { ward: { contains: ward, mode: 'insensitive' } }),
      ...(wardId && { wardId }),
      ...(streetId && { streetId }),
      ...(hamletId && { hamletId }),
      ...(status && { status }),
      ...(reviewStage && { reviewStage }),
      ...(createdById && { createdById }),
      ...(search && {
        OR: [
          { houseNumber: { contains: search, mode: 'insensitive' } },
          { street: { contains: search, mode: 'insensitive' } },
          { ownerName: { contains: search, mode: 'insensitive' } },
          { ownerPhone: { contains: search, mode: 'insensitive' } },
          { ownerIdNumber: { contains: search, mode: 'insensitive' } },
          { qrCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
  }

  async findAll(query: ListHousesQueryDto) {
    const { page, pageSize, street, ward, wardId, streetId, hamletId, status, reviewStage, search, createdById } =
      query;
    const where = this.buildWhere({
      street,
      ward,
      wardId,
      streetId,
      hamletId,
      status,
      reviewStage,
      search,
      createdById,
    });

    const [items, total] = await this.prisma.$transaction([
      this.prisma.house.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          photos: { orderBy: { createdAt: 'asc' }, take: 1 },
          ...ADDRESS_CATALOG_INCLUDE,
        },
      }),
      this.prisma.house.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * Dữ liệu số nhà dạng GeoJSON FeatureCollection cho bản đồ (Phase 3 — I).
   * Không phân trang (bản đồ cần thấy toàn bộ điểm khớp bộ lọc), nhưng giới
   * hạn MAX_GEOJSON_FEATURES để tránh tải cả CSDL nếu người dùng không lọc.
   */
  async findAllGeoJson(query: GeoJsonQueryDto) {
    const where = this.buildWhere(query);

    const houses = await this.prisma.house.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_GEOJSON_FEATURES,
    });

    const truncated = houses.length === MAX_GEOJSON_FEATURES;
    if (truncated) {
      this.logger.warn(
        `GeoJSON bị cắt bớt ở ${MAX_GEOJSON_FEATURES} điểm — người dùng nên lọc thêm theo đường/phường.`,
      );
    }

    return {
      type: 'FeatureCollection' as const,
      truncated,
      features: houses.map((h) => ({
        type: 'Feature' as const,
        id: h.id,
        geometry: {
          type: 'Point' as const,
          coordinates: [h.longitude, h.latitude],
        },
        properties: {
          id: h.id,
          houseNumber: h.houseNumber,
          street: h.street,
          ward: h.ward,
          district: h.district,
          wardId: h.wardId,
          streetId: h.streetId,
          ownerName: h.ownerName,
          buildingType: h.buildingType,
          status: h.status,
          qrCode: h.qrCode,
        },
      })),
    };
  }

  /** Thống kê tổng quan cho dashboard (Phase 5 — IX. Báo cáo - Thống kê). */
  async getStats() {
    const grouped = await this.prisma.house.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const byStatus: Record<HouseStatus, number> = {
      [HouseStatus.PENDING]: 0,
      [HouseStatus.APPROVED]: 0,
      [HouseStatus.NEEDS_ADJUST]: 0,
    };
    for (const g of grouped) {
      byStatus[g.status] = g._count._all;
    }

    return {
      total: byStatus.PENDING + byStatus.APPROVED + byStatus.NEEDS_ADJUST,
      approved: byStatus.APPROVED,
      pending: byStatus.PENDING,
      needsAdjust: byStatus.NEEDS_ADJUST,
    };
  }

  /**
   * Xuất danh sách số nhà ra file Excel (.xlsx) theo đúng bộ lọc đang xem
   * (Phase 5 — IX. Báo cáo - Thống kê. "Xuất Excel, PDF").
   */
  async exportToExcel(query: GeoJsonQueryDto): Promise<Buffer> {
    const where = this.buildWhere(query);
    const houses = await this.prisma.house.findMany({
      where,
      orderBy: [{ street: 'asc' }, { houseNumber: 'asc' }],
      take: MAX_EXPORT_ROWS,
    });

    if (houses.length === MAX_EXPORT_ROWS) {
      this.logger.warn(
        `Xuất Excel bị giới hạn ở ${MAX_EXPORT_ROWS} dòng — người dùng nên lọc thêm trước khi xuất.`,
      );
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Tây Ninh GIS';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Danh sách số nhà');
    sheet.columns = [
      { header: 'Số nhà', key: 'houseNumber', width: 12 },
      { header: 'Đường/Phố', key: 'street', width: 26 },
      { header: 'Phường/Xã', key: 'ward', width: 20 },
      { header: 'Quận/Huyện/TP', key: 'district', width: 22 },
      { header: 'Chủ sở hữu', key: 'ownerName', width: 24 },
      { header: 'Số điện thoại', key: 'ownerPhone', width: 15 },
      { header: 'Số CCCD/CMND', key: 'ownerIdNumber', width: 16 },
      { header: 'Loại công trình', key: 'buildingType', width: 20 },
      { header: 'Số tầng', key: 'floors', width: 10 },
      { header: 'Diện tích (m²)', key: 'area', width: 14 },
      { header: 'Trạng thái', key: 'status', width: 18 },
      { header: 'Mã QR', key: 'qrCode', width: 16 },
      { header: 'Vĩ độ', key: 'latitude', width: 12 },
      { header: 'Kinh độ', key: 'longitude', width: 12 },
      { header: 'Số tờ bản đồ', key: 'soTo', width: 12 },
      { header: 'Số thửa đất', key: 'soThua', width: 12 },
      { header: 'Hiện trạng nhà', key: 'usageStatus', width: 18 },
      { header: 'Nhu cầu gắn biển', key: 'plateNeed', width: 16 },
      { header: 'Phía đường', key: 'side', width: 14 },
      { header: 'Giai đoạn duyệt', key: 'reviewStage', width: 16 },
      { header: 'Ngày tạo', key: 'createdAt', width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };

    for (const h of houses) {
      sheet.addRow({
        houseNumber: h.houseNumber,
        street: h.street,
        ward: h.ward,
        district: h.district ?? '',
        ownerName: h.ownerName,
        ownerPhone: h.ownerPhone ?? '',
        ownerIdNumber: h.ownerIdNumber ?? '',
        buildingType: BUILDING_TYPE_LABELS_VI[h.buildingType] ?? h.buildingType,
        floors: h.floors ?? '',
        area: h.area ?? '',
        status: HOUSE_STATUS_LABELS_VI[h.status] ?? h.status,
        qrCode: h.qrCode,
        latitude: h.latitude,
        longitude: h.longitude,
        soTo: h.soTo ?? '',
        soThua: h.soThua ?? '',
        usageStatus: h.usageStatus ? HOUSE_USAGE_STATUS_LABELS_VI[h.usageStatus] : '',
        plateNeed: h.plateNeed ? PLATE_NEED_LABELS_VI[h.plateNeed] : '',
        side: NUMBERING_SIDE_LABELS_VI[h.side] ?? h.side,
        reviewStage: HOUSE_REVIEW_STAGE_LABELS_VI[h.reviewStage] ?? h.reviewStage,
        createdAt: h.createdAt.toLocaleString('vi-VN'),
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Tra cứu số nhà trong bán kính quanh 1 tọa độ, dùng PostGIS ST_DWithin
   * (Phase 3 — I. "Tìm kiếm theo tọa độ"). Ép kiểu geography để bán kính
   * tính bằng MÉT thay vì độ kinh vĩ.
   */
  async findNearby(query: NearbyQueryDto) {
    const { lat, lng, radius, limit } = query;

    const rows = await this.prisma.$queryRaw<NearbyRow[]>`
      SELECT
        id, "houseNumber", street, ward, district, "ownerName", "ownerPhone", "ownerIdNumber",
        "buildingType", floors, area, status, "qrCode", latitude, longitude,
        "soTo", "soThua", "createdById", "createdAt", "updatedAt",
        ST_Distance(
          geom::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        ) AS distance
      FROM "house"
      WHERE ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radius}
      )
      ORDER BY distance ASC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({ ...r, distance: Math.round(r.distance) }));
  }

  async findOneOrThrow(id: string): Promise<House> {
    const house = await this.prisma.house.findUnique({ where: { id } });
    if (!house) throw new NotFoundException('Không tìm thấy hồ sơ số nhà');
    return house;
  }

  /**
   * Tra cứu công khai bằng mã QR (Phase 10 — XI.11.6, không cần đăng nhập).
   * Chỉ trả field không nhạy cảm — TUYỆT ĐỐI không có tên/SĐT/CCCD chủ hộ,
   * cùng nguyên tắc với /qrcode.png hiện có (xem ghi chú ownerIdNumber ở model House).
   */
  async findPublicSummary(id: string) {
    const house = await this.prisma.house.findUnique({
      where: { id },
      select: {
        id: true,
        houseNumber: true,
        street: true,
        ward: true,
        district: true,
        buildingType: true,
        status: true,
        qrCode: true,
      },
    });
    if (!house) throw new NotFoundException('Không tìm thấy hồ sơ số nhà');
    return house;
  }

  async findOne(id: string) {
    const house = await this.prisma.house.findUnique({
      where: { id },
      include: {
        photos: { orderBy: { createdAt: 'asc' } },
        createdBy: {
          select: { id: true, fullName: true, username: true, role: true },
        },
        ...ADDRESS_CATALOG_INCLUDE,
      },
    });
    if (!house) throw new NotFoundException('Không tìm thấy hồ sơ số nhà');
    return house;
  }

  async getHistory(houseId: string) {
    await this.findOneOrThrow(houseId);
    return this.prisma.houseHistory.findMany({
      where: { houseId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_PAGE_SIZE,
      include: {
        changedBy: {
          select: { id: true, fullName: true, username: true, role: true },
        },
      },
    });
  }

  async create(dto: CreateHouseDto, userId: string) {
    const id = randomUUID();
    const qrCode = `TN-${id.split('-')[0].toUpperCase()}`;

    // Phase 9 — chỉ gắn nhiệm vụ nếu đúng là nhiệm vụ của chính người tạo, tránh gắn nhầm/gắn
    // khống; không tồn tại/không phải của mình thì bỏ qua lặng lẽ (field này chỉ để theo dõi
    // tiến độ, không được phép chặn việc tạo House — xem quyết định #5).
    let surveyAssignmentId: string | undefined;
    if (dto.surveyAssignmentId) {
      const assignment = await this.prisma.surveyAssignment.findUnique({
        where: { id: dto.surveyAssignmentId },
      });
      if (assignment && assignment.assigneeId === userId) {
        surveyAssignmentId = assignment.id;
      }
    }

    const house = await this.prisma.$transaction(async (tx) => {
      const created = await tx.house.create({
        data: {
          id,
          qrCode,
          houseNumber: dto.houseNumber,
          street: dto.street,
          ward: dto.ward,
          district: dto.district,
          districtId: dto.districtId,
          wardId: dto.wardId,
          hamletId: dto.hamletId,
          streetId: dto.streetId,
          alleyId: dto.alleyId,
          ownerName: dto.ownerName,
          ownerPhone: dto.ownerPhone,
          ownerIdNumber: dto.ownerIdNumber,
          buildingType: dto.buildingType,
          floors: dto.floors,
          area: dto.area,
          status: dto.status ?? undefined,
          latitude: dto.latitude,
          longitude: dto.longitude,
          soTo: dto.soTo,
          soThua: dto.soThua,
          usageStatus: dto.usageStatus,
          plateNeed: dto.plateNeed,
          side: dto.side ?? undefined,
          note: dto.note,
          createdById: userId,
          surveyAssignmentId,
        },
      });

      await tx.houseHistory.create({
        data: {
          houseId: created.id,
          action: 'CREATE',
          changes: { after: created } as unknown as Prisma.InputJsonValue,
          changedById: userId,
        },
      });

      return created;
    });

    return house;
  }

  async update(id: string, dto: UpdateHouseDto, userId: string) {
    const existing = await this.findOneOrThrow(id);

    const changes: { field: string; old: unknown; new: unknown }[] = [];
    for (const field of TRACKED_FIELDS) {
      if (dto[field] === undefined) continue;
      const oldValue = existing[field as keyof House];
      const newValue = dto[field];
      if (oldValue !== newValue) {
        changes.push({ field, old: oldValue, new: newValue });
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.house.update({
        where: { id },
        data: {
          houseNumber: dto.houseNumber,
          street: dto.street,
          ward: dto.ward,
          district: dto.district,
          districtId: dto.districtId,
          wardId: dto.wardId,
          hamletId: dto.hamletId,
          streetId: dto.streetId,
          alleyId: dto.alleyId,
          ownerName: dto.ownerName,
          ownerPhone: dto.ownerPhone,
          ownerIdNumber: dto.ownerIdNumber,
          buildingType: dto.buildingType,
          floors: dto.floors,
          area: dto.area,
          status: dto.status,
          latitude: dto.latitude,
          longitude: dto.longitude,
          soTo: dto.soTo,
          soThua: dto.soThua,
          usageStatus: dto.usageStatus,
          plateNeed: dto.plateNeed,
          side: dto.side,
          reviewStage: dto.reviewStage,
          note: dto.note,
        },
      });

      if (changes.length > 0) {
        await tx.houseHistory.create({
          data: {
            houseId: id,
            action: 'UPDATE',
            changes: changes as unknown as Prisma.InputJsonValue,
            changedById: userId,
          },
        });
      }

      return result;
    });

    return updated;
  }

  async addPhoto(houseId: string, file: Express.Multer.File, type: string | undefined, userId: string) {
    await this.findOneOrThrow(houseId);

    const resolvedType: PhotoType =
      type === PhotoType.FACADE || type === PhotoType.PLATE ? type : PhotoType.CONDITION;

    return this.prisma.$transaction(async (tx) => {
      const photo = await tx.housePhoto.create({
        data: {
          houseId,
          url: `/uploads/houses/${file.filename}`,
          type: resolvedType,
        },
      });

      await tx.houseHistory.create({
        data: {
          houseId,
          action: 'PHOTO_ADD',
          changes: [
            { field: 'photo', old: null, new: { url: photo.url, type: photo.type } },
          ] as unknown as Prisma.InputJsonValue,
          changedById: userId,
        },
      });

      return photo;
    });
  }

  async removePhoto(houseId: string, photoId: string, userId: string) {
    const photo = await this.prisma.housePhoto.findUnique({ where: { id: photoId } });
    if (!photo || photo.houseId !== houseId) {
      throw new NotFoundException('Không tìm thấy ảnh');
    }

    await this.prisma.$transaction([
      this.prisma.housePhoto.delete({ where: { id: photoId } }),
      this.prisma.houseHistory.create({
        data: {
          houseId,
          action: 'PHOTO_DELETE',
          changes: [
            { field: 'photo', old: { url: photo.url, type: photo.type }, new: null },
          ] as unknown as Prisma.InputJsonValue,
          changedById: userId,
        },
      }),
    ]);

    // photo.url có dạng "/uploads/houses/<file>" — bỏ tiền tố "/uploads/" để ghép với thư mục gốc trên host
    const relativePath = photo.url.replace(/^\/uploads\//, '');
    const absolutePath = path.join(getUploadRoot(), relativePath);
    fs.unlink(absolutePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        this.logger.warn(`Không xóa được file ảnh trên host: ${absolutePath} (${err.message})`);
      }
    });

    return photo;
  }

  /** Sinh ảnh QR (PNG buffer) từ chuỗi định danh qrCode đã lưu. */
  async getQrPngBuffer(house: Pick<House, 'qrCode'>): Promise<Buffer> {
    return QRCode.toBuffer(house.qrCode, {
      type: 'png',
      width: 300,
      margin: 1,
    });
  }
}
