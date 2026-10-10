'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onUnauthorized, refreshSession, setAccessToken } from '@/lib/api-client';
import { authService, type LoginInput, type RegisterInput } from '@/services/auth.service';
import type { Role, User } from '@/types/api';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  /** True when the last session ended because tokens expired (not an explicit logout). */
  sessionExpired: boolean;
  login: (input: LoginInput) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    refreshSession().then((session) => {
      if (cancelled) return;
      setUserState(session?.user ?? null);
      setStatus(session ? 'authenticated' : 'unauthenticated');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      onUnauthorized(() => {
        setAccessToken(null);
        setUserState(null);
        setSessionExpired(true);
        setStatus('unauthenticated');
        queryClient.clear();
      }),
    [queryClient],
  );

  const startSession = useCallback((payload: { user: User; accessToken: string }) => {
    setAccessToken(payload.accessToken);
    setUserState(payload.user);
    setSessionExpired(false);
    setStatus('authenticated');
    return payload.user;
  }, []);

  const login = useCallback(
    async (input: LoginInput) => startSession(await authService.login(input)),
    [startSession],
  );

  const register = useCallback(
    async (input: RegisterInput) => startSession(await authService.register(input)),
    [startSession],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setAccessToken(null);
      setUserState(null);
      setSessionExpired(false);
      setStatus('unauthenticated');
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      sessionExpired,
      login,
      register,
      logout,
      setUser: setUserState,
      hasRole: (...roles) => Boolean(user && roles.includes(user.role)),
    }),
    [user, status, sessionExpired, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** Narrowed accessor for pages rendered inside the protected dashboard layout. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser requires an authenticated session');
  return user;
}
