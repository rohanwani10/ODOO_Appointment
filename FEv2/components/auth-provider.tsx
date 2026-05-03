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
import { apiFetch } from "@/lib/api";
import { attachRoles, clearSession, getSession, setSession } from "@/lib/session";
import type { AuthResponse, User, UserRole } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  roles: UserRole[];
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    first_name: string;
    last_name: string;
    password: string;
    phone?: string;
    role: "CUSTOMER" | "ORGANIZER";
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (...allowed: UserRole[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    setUser(session?.user ?? null);
    setIsLoading(false);
  }, []);

  const persistAuthResponse = useCallback((response: AuthResponse) => {
    const nextUser = attachRoles(response.user, response.access_token);
    setSession({
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      user: nextUser,
    });
    setUser(nextUser);
  }, []);

  const refreshUser = useCallback(async () => {
    const freshUser = await apiFetch<User>("/api/users/me");
    const session = getSession();
    if (!session) {
      return;
    }

    const nextUser = {
      ...freshUser,
      roles: freshUser.roles,
    };
    setSession({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: nextUser,
    });
    setUser(nextUser);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiFetch<AuthResponse>("/api/auth/login", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ email, password }),
      });
      persistAuthResponse(response);
      await refreshUser();
    },
    [persistAuthResponse, refreshUser],
  );

  const register = useCallback(
    async (payload: {
      email: string;
      first_name: string;
      last_name: string;
      password: string;
      phone?: string;
      role: "CUSTOMER" | "ORGANIZER";
    }) => {
      const response = await apiFetch<AuthResponse>("/api/auth/register", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify(payload),
      });
      persistAuthResponse(response);
      await refreshUser();
    },
    [persistAuthResponse, refreshUser],
  );

  const logout = useCallback(async () => {
    const session = getSession();
    try {
      if (session?.refreshToken) {
        await apiFetch("/api/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: session.refreshToken }),
        });
      }
    } catch {
      // Ignore logout API failures and clear the local session anyway.
    } finally {
      clearSession();
      setUser(null);
    }
  }, []);

  const hasRole = useCallback(
    (...allowed: UserRole[]) => {
      if (!user) {
        return false;
      }
      return allowed.some((role) => user.roles.includes(role));
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      roles: user?.roles ?? [],
      login,
      register,
      logout,
      refreshUser,
      hasRole,
    }),
    [hasRole, isLoading, login, logout, refreshUser, register, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
