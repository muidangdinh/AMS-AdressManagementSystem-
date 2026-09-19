-- TN-04 — Góp ý khách hàng 11/09/2026 (mục Khảo sát): bổ sung 2 loại công
-- trình mới cho BuildingType. Additive-first, không đổi giá trị cũ (nhãn
-- hiển thị "Chung cư đô thị" -> "Nhà chung cư" chỉ đổi ở tầng ứng dụng —
-- packages/shared/src/index.ts + houses.service.ts — KHÔNG đổi tên giá trị
-- enum APARTMENT trong DB, để không phải backfill dữ liệu cũ.
-- LƯU Ý: KHÔNG drop "house_geom_idx" (xem ghi chú ở migration 10).

-- AlterEnum
ALTER TYPE "BuildingType" ADD VALUE 'COMPANY_FACTORY';
ALTER TYPE "BuildingType" ADD VALUE 'RESIDENTIAL_AREA';
