'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ChangePasswordRequest, LoginRequest, LoginResponse, UserSummary } from '@tayninh/shared';
import { ApiError, apiFetch, clearToken, getToken, setToken } from './api';

type CurrentUser = Pick<
  UserSummary,
  'id' | 'username' | 'fullName' | 'role' | 'roles' | 'permissions' | 'unit' | 'position'
>;

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  /** Tự đổi mật khẩu — server xác minh `currentPassword`, ném lỗi nếu sai. */
  changePassword: (dto: ChangePasswordRequest) => Promise<void>;
  /** PHASE 17 — kiểm tra người dùng hiện tại có quyền `code` không. */
  hasPermission: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = 'tayninh_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    // Hiển thị lạc quan từ phiên đã lưu (tránh nháy màn hình)...
    const storedUser = window.localStorage.getItem(USER_KEY);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        window.localStorage.removeItem(USER_KEY);
      }
    }

    // ...rồi LÀM MỚI từ server để lấy roles/permissions mới nhất (Phase 17).
    // Nhờ vậy phiên cũ (lưu trước khi có RBAC, thiếu `permissions`) tự lành mà
    // không cần đăng nhập lại, và thay đổi phân quyền có hiệu lực sau khi tải lại trang.
    apiFetch<CurrentUser>('/api/auth/me')
      .then((fresh) => {
        setUser(fresh);
        window.localStorage.setItem(USER_KEY, JSON.stringify(fresh));
      })
      .catch((err) => {
        // Token hết hạn/không hợp lệ → buộc đăng nhập lại. Lỗi mạng khác thì giữ
        // nguyên phiên lạc quan đã hiển thị ở trên.
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          window.localStorage.removeItem(USER_KEY);
          setUser(null);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const res = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      setToken(res.accessToken);
      window.localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      setUser(res.user);
      router.push('/houses/dashboard');
    },
    [router],
  );

  const logout = useCallback(() => {
    clearToken();
    window.localStorage.removeItem(USER_KEY);
    setUser(null);
    router.push('/login');
  }, [router]);

  const changePassword = useCallback(async (dto: ChangePasswordRequest) => {
    await apiFetch<void>('/api/auth/me/password', { method: 'PATCH', body: JSON.stringify(dto) });
  }, []);

  const hasPermission = useCallback(
    (code: string) => !!user && Array.isArray(user.permissions) && user.permissions.includes(code),
    [user],
  );

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, changePassword, hasPermission }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>');
  return ctx;
}
