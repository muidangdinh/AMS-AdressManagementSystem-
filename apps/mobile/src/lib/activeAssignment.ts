import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Phase 9 — "nhiệm vụ đang khảo sát", chọn từ tab Nhiệm Vụ, đọc lại ở
 * SurveyScreen để gắn House mới tạo vào đúng nhiệm vụ (tùy chọn, không bắt
 * buộc — xem quyết định #5 trong KE_HOACH_NANG_CAP.md).
 */
const ACTIVE_ASSIGNMENT_KEY = 'tayninh_active_assignment';

export async function getActiveAssignmentId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_ASSIGNMENT_KEY);
}

export async function setActiveAssignmentId(id: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_ASSIGNMENT_KEY, id);
}

export async function clearActiveAssignmentId(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_ASSIGNMENT_KEY);
}
