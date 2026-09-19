import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { LoginRequest, LoginResponse, UserSummary } from '@tayninh/shared';
import { apiFetch, clearToken, getStoredUser, getToken, setStoredUser, setToken } from './api';

type CurrentUser = Pick<UserSummary, 'id' | 'username' | 'fullName' | 'role' | 'unit' | 'position'>;

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
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

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>');
  return ctx;
}
