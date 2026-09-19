import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { getActiveAssignmentId } from './activeAssignment';
import { getAssignment } from './surveysApi';

/** Sự kiện nội bộ — đồng bộ ngay các `useWorkingWard()` khác đang mount CÙNG màn hình khi người
 * dùng đổi xã tự chọn (vd WardSelectorBar + DashboardScreen cùng lúc) — không chờ focus lại. */
const WARD_CHANGE_EVENT = 'tayninh:working-ward-change';

/**
 * TN-03 — Ngữ cảnh "xã đang làm việc" (góp ý khách hàng 11/09/2026: hệ
 * thống phục vụ NHIỀU xã, không phải một xã cố định — xem BACKLOG.md mục
 * "Mô hình xã đang làm việc"). Giải theo 3 lớp ưu tiên, dừng ở lớp đầu tiên
 * có giá trị:
 *   1. Xã của NHIỆM VỤ KHẢO SÁT đang chọn (`activeAssignment.zone.ward`) —
 *      đã có sẵn dữ liệu này từ Phase 9, chỉ là chưa dùng để đặt ngữ cảnh.
 *   2. Xã công tác gán cho tài khoản (`User.wardId`) — CHƯA làm ở đợt này,
 *      hoãn sang đợt phân quyền theo địa bàn (xem BACKLOG.md TN-25).
 *   3. Xã người dùng TỰ CHỌN qua bộ chọn xã, nhớ lại ở lần mở app sau.
 *   Không có gì ở cả 3 lớp -> null, giao diện hiểu là "Toàn tỉnh".
 */
export interface WorkingWard {
  id: string;
  name: string;
}

export type WorkingWardSource = 'assignment' | 'manual' | null;

const MANUAL_WARD_KEY = 'tayninh_manual_ward';

export async function getManualWard(): Promise<WorkingWard | null> {
  const raw = await AsyncStorage.getItem(MANUAL_WARD_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkingWard;
  } catch {
    return null;
  }
}

/** Đặt xã tự chọn (lớp 3). Truyền `null` để quay về "Toàn tỉnh". */
export async function setManualWard(ward: WorkingWard | null): Promise<void> {
  if (ward) await AsyncStorage.setItem(MANUAL_WARD_KEY, JSON.stringify(ward));
  else await AsyncStorage.removeItem(MANUAL_WARD_KEY);
  DeviceEventEmitter.emit(WARD_CHANGE_EVENT);
}

/** Xã của nhiệm vụ khảo sát đang chọn (lớp 1) — null nếu không có nhiệm vụ hoặc nhiệm vụ không gán xã. */
async function getAssignmentWard(): Promise<WorkingWard | null> {
  const assignmentId = await getActiveAssignmentId();
  if (!assignmentId) return null;
  try {
    const assignment = await getAssignment(assignmentId);
    const ward = assignment.zone.ward;
    return ward ? { id: ward.id, name: ward.name } : null;
  } catch {
    // Nhiệm vụ không còn hợp lệ (đã xoá/đổi trạng thái) — rơi xuống lớp sau, không chặn UI.
    return null;
  }
}

/** Giải ngữ cảnh xã đang làm việc theo đúng 3 lớp ưu tiên ở trên. */
export async function resolveWorkingWard(): Promise<{ ward: WorkingWard | null; source: WorkingWardSource }> {
  const fromAssignment = await getAssignmentWard();
  if (fromAssignment) return { ward: fromAssignment, source: 'assignment' };

  const fromManual = await getManualWard();
  if (fromManual) return { ward: fromManual, source: 'manual' };

  return { ward: null, source: null };
}

/**
 * Hook tiện dụng cho màn hình: tự giải lại ngữ cảnh mỗi khi màn hình được
 * focus (đúng nhịp với cách `activeAssignment` đang được đọc lại ở
 * SurveyScreen) và cung cấp hàm đổi xã tự chọn.
 */
export function useWorkingWard() {
  const [ward, setWardState] = useState<WorkingWard | null>(null);
  const [source, setSource] = useState<WorkingWardSource>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => setRefreshToken((t) => t + 1), []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(WARD_CHANGE_EVENT, refresh);
    return () => sub.remove();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      resolveWorkingWard().then((res) => {
        if (cancelled) return;
        setWardState(res.ward);
        setSource(res.source);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshToken]),
  );

  /** Người dùng tự chọn 1 xã từ bộ chọn — chỉ có tác dụng khi KHÔNG có nhiệm vụ đang chọn (lớp 1 luôn thắng). */
  const chooseWard = useCallback(
    async (next: WorkingWard | null) => {
      await setManualWard(next);
      refresh();
    },
    [refresh],
  );

  return { ward, source, loading, chooseWard, refresh };
}
