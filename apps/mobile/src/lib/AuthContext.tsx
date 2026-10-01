import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ChangePasswordRequest, LoginRequest, LoginResponse, UserSummary } from '@tayninh/shared';
import { apiFetch, clearToken, getStoredUser, getToken, setStoredUser, setToken } from './api';

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
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const storedUser = await getStoredUser<CurrentUser>();
      if (token && storedUser) setUser(storedUser);
      setIsLoading(false);
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

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>');
  return ctx;
}
