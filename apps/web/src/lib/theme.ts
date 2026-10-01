'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Theme sáng/tối của web (UI.md — mặc định TỐI). Nguồn sự thật là thuộc tính `data-theme`
 * trên <html>: script inline ở `app/layout.tsx` đặt nó TRƯỚC khi vẽ trang (tránh nháy màu),
 * hook này chỉ đọc/đổi và đồng bộ giữa các component qua sự kiện tuỳ biến (cùng cách
 * `lib/working-ward.ts`) — vd bản đồ Leaflet đổi tile, Chart.js đổi màu chữ khi đổi theme.
 */
export type Theme = 'dark' | 'light';

export const THEME_KEY = 'tayninh_theme';
const CHANGE_EVENT = 'tayninh:theme-change';

export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // localStorage bị chặn (chế độ riêng tư…) — vẫn đổi theme cho phiên hiện tại.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Script chạy trong <head> trước khi vẽ: đọc theme đã lưu, mặc định tối. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');document.documentElement.dataset.theme=t==='light'?'light':'dark';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    setThemeState(getTheme());
    const handler = () => setThemeState(getTheme());
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);

  const toggle = useCallback(() => setTheme(getTheme() === 'dark' ? 'light' : 'dark'), []);

  return { theme, toggle };
}
