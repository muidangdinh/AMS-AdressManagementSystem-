import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { syncAllPending } from './surveyStore';

/**
 * Tự động đồng bộ hồ sơ khảo sát đang chờ mỗi khi thiết bị VỪA có lại mạng
 * (chuyển từ offline -> online) — chỉ gọi khi `enabled` (đã đăng nhập).
 */
export function useAutoSync(enabled: boolean) {
  const wasConnected = useRef<boolean | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = !!state.isConnected;
      if (isConnected && wasConnected.current === false) {
        syncAllPending().catch(() => {
          // Lỗi đồng bộ nền — người dùng vẫn có thể đồng bộ thủ công ở tab Đã Lưu.
        });
      }
      wasConnected.current = isConnected;
    });

    return unsubscribe;
  }, [enabled]);
}
