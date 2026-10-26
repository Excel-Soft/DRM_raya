"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchAuthMe, logout as apiLogout } from "@/lib/auth/auth-api";
import { ApiError } from "@/lib/api/errors";
import { clearSession, getStoredToken, persistLoginSession, setAuthMessage } from "@/lib/auth/session";
import type { AuthMeResponse, AuthStatus, AuthUser } from "@/lib/auth/types";
import { toast } from "@/lib/toast";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  errorMessage: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  applyLogin: (payload: { token: string; user: AuthMeResponse }) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const me = await fetchAuthMe();
      setUser(me);
      setStatus("authenticated");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        if (getStoredToken()) {
          setAuthMessage("Your session has expired. Please sign in again.");
        }
        clearSession();
        setUser(null);
        setStatus("unauthenticated");
        return;
      }
      setUser(null);
      setStatus("error");
      const msg = e instanceof Error ? e.message : "Authentication check failed";
      setErrorMessage(msg);
      toast.error(msg);
    }
  }, []);

  useEffect(() => {
    // Bootstrap session from Express /api/auth/me on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional session bootstrap
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      clearSession();
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const applyLogin = useCallback((payload: { token: string; user: AuthMeResponse }) => {
    persistLoginSession({ token: payload.token, user: payload.user });
    setUser(payload.user);
    setStatus("authenticated");
  }, []);

  const value = useMemo(
    () => ({ status, user, errorMessage, refresh, signOut, applyLogin }),
    [status, user, errorMessage, refresh, signOut, applyLogin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext);
}
