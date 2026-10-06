import React from 'react';
import { useAuth } from '../lib/AuthContext';
import SurveyTabs from './SurveyTabs';
import InstallTabs from './InstallTabs';
import AllTabs from './AllTabs';

/** Tham số các tab — dùng chung cho cả 2 phân hệ (mỗi phân hệ chỉ đăng ký một phần số tab). */
export type MainTabsParamList = {
  Dashboard: undefined;
  /** `focusId`/`lat`/`lng` — bay thẳng tới 1 vị trí khi được điều hướng từ Dashboard. */
  Map: { focusId: string; lat: number; lng: number; nonce?: number } | undefined;
  Assignments: undefined;
  /** `resurveyHouseId` — vào chế độ sửa lại đúng nhà bị yêu cầu khảo sát lại (Phase 11 Đợt 2b). */
  Survey: { resurveyHouseId?: string } | undefined;
  /** Thi công gắn biển — chỉ có ở phân hệ thi công (quyền install:execute). */
  Install: undefined;
  Plates: undefined;
  History: undefined;
};

/**
 * Chọn bộ tab theo phân hệ hiện tại (xem KE_HOACH_TACH_MOBILE.md): khảo sát 6 tab, thi công 3 tab, có cả 2 quyền thì đủ 7 tab.
 * Route name `Main` giữ nguyên nên thông báo/điều hướng ngoài không phải đổi.
 */
export default function MainTabs() {
  const { mode } = useAuth();
  if (mode === 'all') return <AllTabs />;
  return mode === 'install' ? <InstallTabs /> : <SurveyTabs />;
}
