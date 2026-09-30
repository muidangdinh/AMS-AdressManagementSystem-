import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { fetchUnreadCount } from './notificationsApi';

const POLL_MS = 60_000;

interface UnreadContextValue {
  count: number;
  refresh: () => Promise<void>;
  /** Chỉnh số tại chỗ (vd vừa đánh dấu đã đọc) để badge đổi ngay, không đợi lần poll sau. */
  setCount: React.Dispatch<React.SetStateAction<number>>;
}

const UnreadContext = createContext<UnreadContextValue>({
  count: 0,
  refresh: async () => {},
  setCount: () => {},
});

/**
 * Số thông báo chưa đọc cho badge chuông. Poll mỗi 60 giây khi app đang mở, và lấy lại ngay khi
 * app quay về foreground. Lỗi mạng (đang offline) bị bỏ qua — giữ số cũ, lần poll sau thử lại.
 */
export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setCount((await fetchUnreadCount()).count);
    } catch {
      // Offline hoặc token hết hạn — không làm gì.
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    refresh();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [user, refresh]);

  const value = useMemo(() => ({ count, refresh, setCount }), [count, refresh]);
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread() {
  return useContext(UnreadContext);
}
