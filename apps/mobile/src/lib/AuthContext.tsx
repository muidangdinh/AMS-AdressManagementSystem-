import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ChangePasswordRequest, LoginRequest, LoginResponse, UserSummary } from '@tayninh/shared';
import { apiFetch, clearToken, getStoredUser, getToken, setStoredUser, setToken } from './api';
import { availableModes as computeModes } from './appMode';
import type { AppMode } from './appMode';

/** `permissions` có sẵn trong phản hồi đăng nhập — dùng để ẩn/hiện tab theo quyền (vd Thi Công). */
type CurrentUser = Pick<UserSummary, 'id' | 'username' | 'fullName' | 'role' | 'unit' | 'position'> & {
  permissions?: string[];
};

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  /** Tự đổi mật khẩu — server xác minh `currentPassword`, ném lỗi nếu sai. */
  changePassword: (dto: ChangePasswordRequest) => Promise<void>;
  /** Các nhóm quyền (khảo sát/thi công) người dùng có. */
  availableModes: ('survey' | 'install')[];
  /** Phân hệ hiển thị: 1 quyền → phân hệ đó; đủ 2 quyền → 'all'; không quyền nào → null. */
  mode: AppMode | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const storedUser = await getStoredUser<CurrentUser>();
      if (token && storedUser) {
        setUser(storedUser);
      }
      setIsLoading(false);
      if (token && storedUser) {
        // Quyền lưu từ lúc đăng nhập có thể đã đổi trên web — làm mới nền, lỗi mạng thì giữ bản cũ.
        apiFetch<{ permissions?: string[] }>('/api/auth/me')
          .then(async (me) => {
            if (!Array.isArray(me.permissions)) return;
            const fresh = { ...storedUser, permissions: me.permissions };
            await setStoredUser(fresh);
            setUser(fresh);
          })
          .catch(() => undefined);
      }
    })();
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    const res = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    await setToken(res.accessToken);
    await setStoredUser(res.user);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  const changePassword = useCallback(async (dto: ChangePasswordRequest) => {
    await apiFetch<void>('/api/auth/me/password', { method: 'PATCH', body: JSON.stringify(dto) });
  }, []);

  const availableModes = useMemo(() => computeModes(user?.permissions), [user?.permissions]);
  // 1 nhóm quyền → phân hệ đó; đủ 2 → 'all' (đủ tab, không phải chọn); không có quyền nào → null.
  const mode: AppMode | null =
    availableModes.length === 2 ? 'all' : availableModes.length === 1 ? availableModes[0] : null;

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, changePassword, availableModes, mode }}
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
