'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiLogin, apiRegister } from '@/services/apiClient';
import type { AuthUser } from '@/types/api';

export type { AuthUser };

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: false;
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
  isLoading: false,
  login: missingAuthProvider,
  register: missingAuthProvider,
  logout: () => {},
};

export function AuthProvider({ children }: { children: ReactNode }) {
  // Phase 2 mock-mode: start logged out so /login is reachable. Both SSR and
  // CSR render `null` initially, so there is no hydration mismatch. Phase 12
  // swaps this for real getMe() bootstrap with localStorage persistence.
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = useCallback(
    async ({ username, password }: { username: string; password: string }) => {
      const data = await apiLogin(username, password);
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
      setUser({
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        is_admin: data.user.is_admin ?? false,
      });
    },
    [],
  );

  const logout = useCallback(() => setUser(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading: false,
      login,
      register,
      logout,
    }),
    [user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx ?? fallbackAuthContext;
}
