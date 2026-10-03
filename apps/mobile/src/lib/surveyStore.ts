import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PhotoType,
  type BuildingType,
  type PlateNeed,
  type NumberingSide,
  type HouseSummary,
} from '@tayninh/shared';
import { apiFetch } from './api';

const DRAFTS_KEY = 'tayninh_survey_drafts';

export type DraftStatus = 'pending_sync' | 'syncing' | 'synced' | 'sync_error';

/** Hồ sơ khảo sát lưu cục bộ trên máy — tạo ở hiện trường, có thể chưa có mạng. */
export interface SurveyDraft {
  localId: string;
  houseNumber: string;
  street: string;
  ward: string;
  district?: string;
  /** Phase 6 — liên kết danh mục địa chỉ chuẩn hoá (tùy chọn, song song với text ở trên). */
  wardId?: string;
  streetId?: string;
  districtId?: string;
  /** TN-07 — Ấp/Thôn (góp ý khách hàng 11/09/2026). Chỉ có FK, không có cột chữ tự do song song. */
  hamletId?: string;
  /** Phase 9 — nhiệm vụ khảo sát đang chọn lúc tạo (tùy chọn, không bắt buộc). */
  surveyAssignmentId?: string;
  ownerName: string;
  ownerPhone?: string;
  ownerIdNumber?: string;
  buildingType: BuildingType;
  floors?: number;
  area?: number;
  soTo?: string;
  soThua?: string;
  /** Hiện trạng nhà lúc khảo sát (Could-have). */
  usageStatusId?: string;
  /** Nhu cầu gắn biển của chủ hộ lúc khảo sát. */
  plateNeed?: PlateNeed;
  /** Phía đường (chẵn/lẻ) ghi nhận lúc khảo sát. */
  side?: NumberingSide;
  latitude: number;
  longitude: number;
  /** Ảnh mặt tiền nhà — ô bắt buộc riêng (cảnh báo mềm nếu thiếu lúc gửi duyệt). */
  facadePhotoUri?: string;
  /** Ảnh biển số nhà — ô bắt buộc riêng (cảnh báo mềm nếu thiếu lúc gửi duyệt). */
  platePhotoUri?: string;
  /** Đường dẫn file ảnh khác/hiện trạng cục bộ (file://... hoặc content://...) — tối đa 5 ảnh. */
  photoUris?: string[];
  note?: string;
  status: DraftStatus;
  /** id House thật trên server sau khi đồng bộ thành công. */
  remoteHouseId?: string;
  syncError?: string;
  createdAt: string;
}

function generateLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getDrafts(): Promise<SurveyDraft[]> {
  const raw = await AsyncStorage.getItem(DRAFTS_KEY);
  return raw ? (JSON.parse(raw) as SurveyDraft[]) : [];
}

async function saveDrafts(drafts: SurveyDraft[]): Promise<void> {
  await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

/** Tạo 1 hồ sơ khảo sát mới, trạng thái ban đầu "pending_sync". */
export async function createDraft(
  input: Omit<SurveyDraft, 'localId' | 'status' | 'createdAt'>,
): Promise<SurveyDraft> {
  const draft: SurveyDraft = {
    ...input,
    localId: generateLocalId(),
    status: 'pending_sync',
    createdAt: new Date().toISOString(),
  };
  const drafts = await getDrafts();
  drafts.unshift(draft);
  await saveDrafts(drafts);
  return draft;
}

export async function deleteDraft(localId: string): Promise<void> {
  const drafts = await getDrafts();
  await saveDrafts(drafts.filter((d) => d.localId !== localId));
}

async function updateDraft(localId: string, patch: Partial<SurveyDraft>): Promise<void> {
  const drafts = await getDrafts();
  const next = drafts.map((d) => (d.localId === localId ? { ...d, ...patch } : d));
  await saveDrafts(next);
}

/**
 * Tải 1 ảnh lên hồ sơ nhà đã có (API chỉ nhận 1 file/request). Dùng chung cho đồng bộ nháp và cho chế độ
 * "sửa lại nhà" (Phase 11 Đợt 2b).
 */
export async function uploadHousePhoto(
  houseId: string,
  photo: { uri: string; type: PhotoType },
  fileName: string,
): Promise<void> {
  const formData = new FormData();
  // React Native FormData nhận object { uri, type, name } cho file cục bộ.
  formData.append('file', {
    uri: photo.uri,
    type: 'image/jpeg',
    name: fileName,
  } as unknown as Blob);
  formData.append('type', photo.type);
  await apiFetch(`/api/houses/${houseId}/photos`, {
    method: 'POST',
    body: formData,
  });
}

/**
 * Đồng bộ 1 hồ sơ nháp lên server: tạo House qua API rồi upload ảnh (nếu có).
 * Dùng lại đúng API đã có ở Phase 2/3 (POST /api/houses, POST /api/houses/:id/photos).
 */
export async function syncDraft(draft: SurveyDraft): Promise<SurveyDraft> {
  await updateDraft(draft.localId, { status: 'syncing' });
  try {
    const house = await apiFetch<HouseSummary>('/api/houses', {
      method: 'POST',
      body: JSON.stringify({
        houseNumber: draft.houseNumber,
        street: draft.street,
        ward: draft.ward,
        district: draft.district,
        wardId: draft.wardId,
        streetId: draft.streetId,
        districtId: draft.districtId,
        hamletId: draft.hamletId,
        surveyAssignmentId: draft.surveyAssignmentId,
        ownerName: draft.ownerName,
        ownerPhone: draft.ownerPhone,
        ownerIdNumber: draft.ownerIdNumber,
        buildingType: draft.buildingType,
        floors: draft.floors,
        area: draft.area,
        soTo: draft.soTo,
        soThua: draft.soThua,
        usageStatusId: draft.usageStatusId,
        plateNeed: draft.plateNeed,
        side: draft.side,
        note: draft.note,
        latitude: draft.latitude,
        longitude: draft.longitude,
      }),
    });

    // Upload tuần tự từng ảnh — API chỉ nhận 1 file/request (FileInterceptor đơn).
    // Gắn PhotoType tường minh theo ô người dùng đã chụp (không còn suy theo vị trí mảng).
    const uploads: { uri: string; type: PhotoType }[] = [
      ...(draft.facadePhotoUri ? [{ uri: draft.facadePhotoUri, type: PhotoType.FACADE }] : []),
      ...(draft.platePhotoUri ? [{ uri: draft.platePhotoUri, type: PhotoType.PLATE }] : []),
      ...(draft.photoUris ?? []).map((uri) => ({ uri, type: PhotoType.CONDITION })),
    ];
    for (const [index, { uri, type }] of uploads.entries()) {
      await uploadHousePhoto(house.id, { uri, type }, `${draft.localId}-${index}.jpg`);
    }

    const updated: SurveyDraft = { ...draft, status: 'synced', remoteHouseId: house.id };
    await updateDraft(draft.localId, { status: 'synced', remoteHouseId: house.id });
    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Đồng bộ thất bại';
    await updateDraft(draft.localId, { status: 'sync_error', syncError: message });
    throw err;
  }
}

/** Đồng bộ tất cả hồ sơ đang chờ (pending_sync hoặc lỗi lần trước) — gọi khi có mạng trở lại. */
export async function syncAllPending(): Promise<{ succeeded: number; failed: number }> {
  const drafts = await getDrafts();
  const pending = drafts.filter((d) => d.status === 'pending_sync' || d.status === 'sync_error');

  let succeeded = 0;
  let failed = 0;
  for (const draft of pending) {
    try {
      await syncDraft(draft);
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }
  return { succeeded, failed };
}
