'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LoginRequest, LoginResponse, UserSummary } from '@tayninh/shared';
import { apiFetch, clearToken, getToken, setToken } from './api';

type CurrentUser = Pick<UserSummary, 'id' | 'username' | 'fullName' | 'role' | 'unit' | 'position'>;

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = 'tayninh_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    const storedUser = window.localStorage.getItem(USER_KEY);
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        clearToken();
      }
    }
    setIsLoading(false);
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
