'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  apiFetchCurrentUser,
  apiLogin,
  apiRegister,
} from '@/services/apiClient';
import { clearAccessToken, getAccessToken, setAccessToken } from '@/auth/authSession';
import type { AuthUser } from '@/types/api';

export type { AuthUser };

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (params: { username: string; password: string }) => Promise<void>;
  register: (params: {
    username: string;
    password: string;
    email?: string;
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const missingAuthProvider = async () => {
  throw new Error('AuthProvider is not mounted.');
};

const fallbackAuthContext: AuthContextValue = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: missingAuthProvider,
  register: missingAuthProvider,
  logout: () => {},
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const bootstrapUser = async () => {
      if (!getAccessToken()) {
        if (mounted) setIsLoading(false);
        return;
      }
      try {
        const me = await apiFetchCurrentUser();
        if (!mounted) return;
        setUser({
          id: me.id,
          username: me.username,
          email: me.email,
          is_admin: me.is_admin ?? false,
        });
      } catch {
        if (!mounted) return;
        setUser(null);
        clearAccessToken();
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void bootstrapUser();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(
    async ({ username, password }: { username: string; password: string }) => {
      const data = await apiLogin(username, password);
      setAccessToken(data.access_token);
      setUser({
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        is_admin: data.user.is_admin ?? false,
      });
    },
    [],
  );

  const register = useCallback(
    async ({
      username,
      password,
      email,
    }: {
      username: string;
      password: string;
      email?: string;
    }) => {
      const data = await apiRegister(username, password, email);
      setAccessToken(data.access_token);
      setUser({
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        is_admin: data.user.is_admin ?? false,
      });
    },
    [],
  );

  const logout = useCallback(() => {
    clearAccessToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx ?? fallbackAuthContext;
}
