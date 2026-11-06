import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import * as ExcelJS from 'exceljs';
import {
  AssignmentStatus,
  BuildingType,
  House,
  HouseStatus,
  PlateNeed,
  NumberingSide,
  HouseReviewStage,
  PhotoType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  houseScopeSql,
  houseScopeWhere,
  OUT_OF_SCOPE_HOUSE,
  resolveHamletForWrite,
} from '../auth/data-scope';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { getUploadRoot } from '../config/upload.config';
import { CreateHouseDto } from './dto/create-house.dto';
import { UpdateHouseDto } from './dto/update-house.dto';
import { UpdateHouseLocationDto } from './dto/update-house-location.dto';
import { ResurveyHouseDto } from './dto/resurvey-house.dto';
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
  streetId: string | null;
  ward: string;
  wardId: string | null;
  hamletId: string | null;
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
  usageStatus: { select: { id: true, name: true } },
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
  'usageStatusId',
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

  async findAll(query: ListHousesQueryDto, user: AuthenticatedUser) {
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
    where.AND = [houseScopeWhere(user)];

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
   * Không phân trang nhưng giới hạn MAX_GEOJSON_FEATURES để tránh tải cả CSDL.
   * Có thể lọc thêm theo bbox của khung nhìn (west/south/east/north).
   */
  async findAllGeoJson(query: GeoJsonQueryDto, user: AuthenticatedUser) {
    const where = { ...this.buildWhere(query), AND: [houseScopeWhere(user)] };
    const bbox = [query.west, query.south, query.east, query.north];

    if (bbox.some((value) => value !== undefined)) {
      const [west, south, east, north] = bbox;
      if (west === undefined || south === undefined || east === undefined || north === undefined) {
        throw new BadRequestException('Cần truyền đủ west, south, east, north cho vùng bản đồ');
      }
      if (west >= east || south >= north) {
        throw new BadRequestException('Vùng bản đồ không hợp lệ: cần west < east và south < north');
      }
      // shortcut: bbox lọc bằng index btree (latitude, longitude); khi dữ liệu vượt vài trăm nghìn điểm, chuyển sang geom && ST_MakeEnvelope (GiST).
      where.AND.push({
        latitude: { gte: south, lte: north },
        longitude: { gte: west, lte: east },
      });
    }

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
  async getStats(user: AuthenticatedUser) {
    const grouped = await this.prisma.house.groupBy({
      by: ['status'],
      where: houseScopeWhere(user),
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
  async exportToExcel(query: GeoJsonQueryDto, user: AuthenticatedUser): Promise<Buffer> {
    const where = { ...this.buildWhere(query), AND: [houseScopeWhere(user)] };
    const houses = await this.prisma.house.findMany({
      where,
      orderBy: [{ street: 'asc' }, { houseNumber: 'asc' }],
      take: MAX_EXPORT_ROWS,
      include: { usageStatus: { select: { name: true } } },
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
        usageStatus: h.usageStatus?.name ?? '',
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
  async findNearby(query: NearbyQueryDto, user: AuthenticatedUser) {
    const { lat, lng, radius, limit } = query;

    const rows = await this.prisma.$queryRaw<NearbyRow[]>`
      SELECT
        id, "houseNumber", street, "streetId", ward, "wardId", "hamletId", district, "ownerName", "ownerPhone", "ownerIdNumber",
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
      ${houseScopeSql(user)}
      ORDER BY distance ASC
      LIMIT ${limit}
    `;

    // Tên ấp (để mobile điền sẵn khu vực khi chọn chủ hộ gần đây) — 1 truy vấn cho cả danh sách.
    const hamletIds = [...new Set(rows.map((r) => r.hamletId).filter((id): id is string => !!id))];
    const hamlets = hamletIds.length
      ? await this.prisma.hamlet.findMany({ where: { id: { in: hamletIds } }, select: { id: true, name: true } })
      : [];
    const hamletName = new Map(hamlets.map((h) => [h.id, h.name]));

    return rows.map((r) => ({
      ...r,
      hamletName: r.hamletId ? (hamletName.get(r.hamletId) ?? null) : null,
      distance: Math.round(r.distance),
    }));
  }

  /**
   * Gợi ý chủ hộ cho form khảo sát (mobile): tìm theo TÊN (không dấu, không phân biệt hoa/thường) hoặc
   * SĐT (so khớp theo chữ số — gõ có/không dấu cách, dấu chấm đều được), gom theo (tên, SĐT, CCCD) kèm
   * số nhà và vài nhà gần nhất để cán bộ nhận ra đúng người. Cần extension `unaccent` (migration
   * 20261002120000_unaccent). `q` ngắn hơn 2 ký tự trả về rỗng.
   */
  async searchOwners(q: string | undefined, user: AuthenticatedUser) {
    const term = (q ?? '').trim();
    if (term.length < 2) return [];
    // Escape ký tự đặc biệt của LIKE để người dùng gõ % hoặc _ không thành ký tự đại diện.
    const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const digits = term.replace(/\D/g, '');
    const phoneCond =
      digits.length >= 3
        ? Prisma.sql`OR regexp_replace(coalesce("ownerPhone", ''), '\\D', '', 'g') LIKE ${`%${digits}%`}`
        : Prisma.empty;

    const groups = await this.prisma.$queryRaw<
      {
        ownerName: string;
        ownerPhone: string | null;
        ownerIdNumber: string | null;
        houseCount: number;
        houseIds: string[];
      }[]
    >(Prisma.sql`
      SELECT "ownerName", "ownerPhone", "ownerIdNumber",
             count(*)::int AS "houseCount",
             (array_agg(id ORDER BY "updatedAt" DESC))[1:5] AS "houseIds"
      FROM house
      WHERE (unaccent(lower("ownerName")) LIKE unaccent(lower(${like}))
      ${phoneCond})
      ${houseScopeSql(user)}
      GROUP BY "ownerName", "ownerPhone", "ownerIdNumber"
      ORDER BY max("updatedAt") DESC
      LIMIT 20
    `);
    if (groups.length === 0) return [];

    const houses = await this.prisma.house.findMany({
      where: { id: { in: groups.flatMap((g) => g.houseIds) } },
      select: {
        id: true,
        houseNumber: true,
        street: true,
        streetId: true,
        ward: true,
        wardId: true,
        hamletId: true,
        hamlet: { select: { name: true } },
        status: true,
      },
    });
    const byId = new Map(houses.map((h) => [h.id, h]));

    return groups.map((g) => {
      const list = g.houseIds.map((id) => byId.get(id)).filter((h): h is NonNullable<typeof h> => !!h);
      const latest = list[0];
      return {
        ownerName: g.ownerName,
        ownerPhone: g.ownerPhone,
        ownerIdNumber: g.ownerIdNumber,
        houseCount: g.houseCount,
        // Khu vực của nhà gần nhất — dùng điền sẵn xã/ấp/đường cho hồ sơ mới.
        latest: latest
          ? {
              street: latest.street,
              streetId: latest.streetId,
              ward: latest.ward,
              wardId: latest.wardId,
              hamletId: latest.hamletId,
              hamletName: latest.hamlet?.name ?? null,
            }
          : null,
        houses: list.map((h) => ({
          id: h.id,
          houseNumber: h.houseNumber,
          street: h.street,
          ward: h.ward,
          status: h.status,
        })),
      };
    });
  }

  /** Không kiểm tra phạm vi — chỉ dùng cho route công khai (ảnh QR). */
  async findOneOrThrow(id: string): Promise<House> {
    const house = await this.prisma.house.findUnique({ where: { id } });
    if (!house) throw new NotFoundException('Không tìm thấy hồ sơ số nhà');
    return house;
  }

  /** Nhà ngoài phạm vi của tài khoản (cán bộ ấp) cũng báo "không tìm thấy" để không lộ dữ liệu. */
  private async findInScopeOrThrow(id: string, user: AuthenticatedUser): Promise<House> {
    const house = await this.prisma.house.findFirst({ where: { id, ...houseScopeWhere(user) } });
    if (!house) throw new NotFoundException(OUT_OF_SCOPE_HOUSE);
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

  async findOne(id: string, user: AuthenticatedUser) {
    const house = await this.prisma.house.findFirst({
      where: { id, ...houseScopeWhere(user) },
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

  async getHistory(houseId: string, user: AuthenticatedUser) {
    await this.findInScopeOrThrow(houseId, user);
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

  async create(dto: CreateHouseDto, user: AuthenticatedUser) {
    const userId = user.id;
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

    // Cán bộ ấp: bỏ trống ấp thì gán ấp của mình; chọn ấp khác bị chặn, trừ nhà thuộc nhiệm vụ của mình.
    const hamletId = resolveHamletForWrite(user, dto.hamletId, !!surveyAssignmentId);
    let wardId = dto.wardId;
    if (hamletId && hamletId !== dto.hamletId && !wardId) {
      wardId = (await this.prisma.hamlet.findUnique({ where: { id: hamletId }, select: { wardId: true } }))?.wardId;
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
          wardId,
          hamletId,
          streetId: dto.streetId,
          alleyId: dto.alleyId,
          ownerName: dto.ownerName,
          ownerPhone: dto.ownerPhone,
          ownerIdNumber: dto.ownerIdNumber,
          buildingType: dto.buildingType,
          floors: dto.floors,
          area: dto.area,
          status: dto.status ?? undefined,
          // Tạo nhà đã ở trạng thái duyệt sẵn (ADMIN nhập tay) — ghi luôn ngày cấp.
          approvedAt: dto.status === HouseStatus.APPROVED ? new Date() : undefined,
          latitude: dto.latitude,
          longitude: dto.longitude,
          soTo: dto.soTo,
          soThua: dto.soThua,
          usageStatusId: dto.usageStatusId,
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

  /** So sánh các trường được theo dõi với bản ghi hiện có → danh sách thay đổi cho HouseHistory. */
  private diffTracked(existing: House, dto: UpdateHouseDto) {
    const changes: { field: string; old: unknown; new: unknown }[] = [];
    for (const field of TRACKED_FIELDS) {
      if (dto[field] === undefined) continue;
      const oldValue = existing[field as keyof House];
      const newValue = dto[field];
      if (oldValue !== newValue) {
        changes.push({ field, old: oldValue, new: newValue });
      }
    }
    return changes;
  }

  /** Dữ liệu cập nhật từ DTO — dùng chung cho `update` (ADMIN/CADASTRAL) và `resurvey` (SURVEYOR). */
  private updateData(dto: UpdateHouseDto): Prisma.HouseUncheckedUpdateInput {
    return {
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
      usageStatusId: dto.usageStatusId,
      plateNeed: dto.plateNeed,
      side: dto.side,
      reviewStage: dto.reviewStage,
      note: dto.note,
    };
  }

  /**
   * Ngày cấp — tự ghi khi trạng thái chuyển VÀO APPROVED, tự xoá khi chuyển RA KHỎI APPROVED (tránh
   * cột "Ngày cấp" hiện ngày cũ trong khi trạng thái không còn Đã duyệt). Không đổi `status` (`dto.status`
   * undefined) thì giữ nguyên giá trị cũ.
   */
  private computeApprovedAt(
    oldStatus: HouseStatus,
    newStatus: HouseStatus | undefined,
    oldApprovedAt: Date | null,
  ): Date | null {
    if (newStatus === undefined || newStatus === oldStatus) return oldApprovedAt;
    return newStatus === HouseStatus.APPROVED ? new Date() : null;
  }

  async update(id: string, dto: UpdateHouseDto, user: AuthenticatedUser) {
    const userId = user.id;
    const existing = await this.findInScopeOrThrow(id, user);
    // Cán bộ ấp không được chuyển nhà sang ấp khác (hay bỏ trống ấp).
    if (dto.hamletId !== undefined && dto.hamletId !== existing.hamletId) {
      resolveHamletForWrite(user, dto.hamletId ?? '', false);
    }
    const changes = this.diffTracked(existing, dto);
    const approvedAt = this.computeApprovedAt(existing.status, dto.status, existing.approvedAt);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.house.update({
        where: { id },
        data: { ...this.updateData(dto), approvedAt },
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

  /** Điều chỉnh GPS: dùng lại update() để kiểm tra phạm vi + ghi HouseHistory, nhưng chỉ gửi tọa độ. */
  async updateLocation(id: string, dto: UpdateHouseLocationDto, user: AuthenticatedUser) {
    return this.update(id, { latitude: dto.latitude, longitude: dto.longitude }, user);
  }

  /**
   * Phase 11 Đợt 2b — SURVEYOR sửa lại đúng nhà bị người duyệt yêu cầu khảo sát lại (thay vì phải tạo nhà mới trùng).
   * Điều kiện (BR-85): nhà đang có cờ `revisitReason`, thuộc nhiệm vụ CỦA CHÍNH cán bộ này, và nhiệm vụ đang
   * IN_PROGRESS (cán bộ đã bấm "Bắt đầu khảo sát lại"). Sửa xong: xoá cờ, ghi lịch sử nhà + nhật ký nhiệm vụ.
   * Tiến độ nhiệm vụ (số nhà) không đổi vì không tạo nhà mới.
   */
  async resurvey(id: string, dto: ResurveyHouseDto, userId: string) {
    const house = await this.prisma.house.findUnique({
      where: { id },
      include: { surveyAssignment: true },
    });
    if (!house) throw new NotFoundException('Không tìm thấy hồ sơ số nhà');

    const assignment = house.surveyAssignment;
    if (!house.revisitReason || !assignment) {
      throw new ForbiddenException('Nhà này không nằm trong yêu cầu khảo sát lại');
    }
    if (assignment.assigneeId !== userId) {
      throw new ForbiddenException('Chỉ cán bộ được giao nhiệm vụ mới sửa lại được nhà này');
    }
    if (assignment.status !== AssignmentStatus.IN_PROGRESS) {
      throw new ConflictException('Hãy bấm "Bắt đầu khảo sát lại" ở nhiệm vụ trước khi sửa nhà');
    }

    const changes = this.diffTracked(house, dto);
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.house.update({
        where: { id },
        data: { ...this.updateData(dto), revisitReason: null, revisitRequestedAt: null },
      });
      await tx.houseHistory.create({
        data: {
          houseId: id,
          action: 'RESURVEYED',
          changes: [
            ...changes,
            { field: 'revisitReason', old: house.revisitReason, new: null },
          ] as unknown as Prisma.InputJsonValue,
          changedById: userId,
        },
      });
      await tx.surveyAssignmentEvent.create({
        data: {
          assignmentId: assignment.id,
          action: 'HOUSE_RESURVEYED',
          actorId: userId,
          note: `Đã khảo sát lại nhà ${result.houseNumber} ${result.street}`,
        },
      });
      return result;
    });
  }

  async addPhoto(houseId: string, file: Express.Multer.File, type: string | undefined, user: AuthenticatedUser) {
    const userId = user.id;
    await this.findInScopeOrThrow(houseId, user);

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

  async removePhoto(houseId: string, photoId: string, user: AuthenticatedUser) {
    const userId = user.id;
    await this.findInScopeOrThrow(houseId, user);
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

  async remove(id: string, confirmation: string, user: AuthenticatedUser) {
    await this.deleteHouses([id], confirmation, false, user);
  }

  async removeMany(ids: string[], confirmation: string, user: AuthenticatedUser) {
    await this.deleteHouses(ids, confirmation, true, user);
  }

  /** Xóa hẳn nhà + file ảnh đính kèm. Ảnh/biển/lịch sử/phương án cascade theo schema. */
  private async deleteHouses(
    ids: string[],
    confirmation: string,
    bulk: boolean,
    user: AuthenticatedUser,
  ) {
    const uniqueIds = [...new Set(ids)];
    const fileUrls = await this.prisma.$transaction(async (tx) => {
      const houses = await tx.house.findMany({
        where: { id: { in: uniqueIds }, ...houseScopeWhere(user) },
        select: { id: true, houseNumber: true, street: true },
      });
      if (houses.length !== uniqueIds.length) throw new NotFoundException(OUT_OF_SCOPE_HOUSE);
      if (bulk && confirmation !== 'DELETE ALL') {
        throw new BadRequestException('Xác nhận không chính xác — hãy nhập DELETE ALL');
      }
      if (!bulk) {
        const house = houses[0];
        const expected = `DELETE ${house.houseNumber} ${house.street}`;
        if (confirmation !== expected) {
          throw new BadRequestException(`Xác nhận không chính xác — hãy nhập ${expected}`);
        }
      }

      const [photos, plates] = await Promise.all([
        tx.housePhoto.findMany({
          where: { houseId: { in: uniqueIds } },
          select: { url: true },
        }),
        tx.housePlate.findMany({
          where: { houseId: { in: uniqueIds }, installPhotoUrl: { not: null } },
          select: { installPhotoUrl: true },
        }),
      ]);

      await tx.house.deleteMany({ where: { id: { in: uniqueIds } } });

      return [
        ...photos.map((photo) => photo.url),
        ...plates.map((plate) => plate.installPhotoUrl as string),
      ];
    });

    await Promise.all([...new Set(fileUrls)].map((url) => this.deleteUploadedFile(url)));
  }

  private async deleteUploadedFile(url: string) {
    const relativePath = url.replace(/^\/uploads\//, '');
    const absolutePath = path.join(getUploadRoot(), relativePath);
    try {
      await fs.promises.unlink(absolutePath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        this.logger.warn(`Không xóa được file ảnh trên host: ${absolutePath} (${(err as Error).message})`);
      }
    }
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
