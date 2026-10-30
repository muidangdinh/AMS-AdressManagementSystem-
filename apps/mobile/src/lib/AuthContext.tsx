import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, AppState } from 'react-native';
import type {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  UpdateUnitRequest,
  UserSummary,
} from '@tayninh/shared';
import {
  ApiError,
  apiFetch,
  clearToken,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
  setUnauthorizedHandler,
} from './api';
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
  /** Tự cập nhật đơn vị — cập nhật state + bộ nhớ cục bộ để dashboard đổi ngay. */
  updateUnit: (dto: UpdateUnitRequest) => Promise<void>;
  /** Làm mới toàn bộ hồ sơ từ server (đơn vị có thể đã đổi trên web). */
  refreshUser: () => Promise<void>;
  /** Các nhóm quyền (khảo sát/thi công) người dùng có. */
  availableModes: ('survey' | 'install')[];
  /** Phân hệ hiển thị: 1 quyền → phân hệ đó; đủ 2 quyền → 'all'; không quyền nào → null. */
  mode: AppMode | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionExpiredNotified = useRef(false);

  const handleSessionExpired = useCallback(() => {
    setUser(null);
    if (sessionExpiredNotified.current) return;
    sessionExpiredNotified.current = true;
    Alert.alert('Phiên đăng nhập đã hết hạn', 'Vui lòng đăng nhập lại.');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(handleSessionExpired);
    return () => setUnauthorizedHandler(null);
  }, [handleSessionExpired]);

  const refreshUser = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const fresh = await apiFetch<CurrentUser>('/api/auth/me');
      await setStoredUser(fresh);
      setUser(fresh);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) handleSessionExpired();
    }
  }, [handleSessionExpired]);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const storedUser = await getStoredUser<CurrentUser>();
      if (token && storedUser) {
        setUser(storedUser);
      }
      setIsLoading(false);
      if (token) await refreshUser();
    })();
  }, [refreshUser]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshUser().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [refreshUser]);

  const login = useCallback(async (credentials: LoginRequest) => {
    const res = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    await setToken(res.accessToken);
    await setStoredUser(res.user);
    sessionExpiredNotified.current = false;
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    sessionExpiredNotified.current = true;
    await clearToken();
    setUser(null);
  }, []);

  const changePassword = useCallback(async (dto: ChangePasswordRequest) => {
    await apiFetch<void>('/api/auth/me/password', { method: 'PATCH', body: JSON.stringify(dto) });
  }, []);

  const updateUnit = useCallback(
    async (dto: UpdateUnitRequest) => {
      const unit = dto.unit.trim();
      await apiFetch<void>('/api/auth/me/unit', {
        method: 'PATCH',
        body: JSON.stringify({ unit }),
      });
      if (!user) return;
      const fresh = { ...user, unit: unit || null };
      await setStoredUser(fresh);
      setUser(fresh);
    },
    [user],
  );

  const availableModes = useMemo(() => computeModes(user?.permissions), [user?.permissions]);
  // 1 nhóm quyền → phân hệ đó; đủ 2 → 'all' (đủ tab, không phải chọn); không có quyền nào → null.
  const mode: AppMode | null =
    availableModes.length === 2 ? 'all' : availableModes.length === 1 ? availableModes[0] : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        changePassword,
        updateUnit,
        refreshUser,
        availableModes,
        mode,
      }}
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
