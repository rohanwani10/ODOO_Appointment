import { getRolesFromToken } from "@/lib/jwt";
import type { AuthResponse, User } from "@/lib/types";

export const ACCESS_TOKEN_KEY = "fev2_access_token";
export const REFRESH_TOKEN_KEY = "fev2_refresh_token";
export const USER_KEY = "fev2_user";

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

export function attachRoles(
  rawUser: AuthResponse["user"],
  accessToken: string,
): User {
  return {
    ...rawUser,
    roles: getRolesFromToken(accessToken),
  };
}

export function getSession(): Session | null {
  if (typeof window === "undefined") {
    return null;
  }

  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  const rawUser = window.localStorage.getItem(USER_KEY);

  if (!accessToken || !refreshToken || !rawUser) {
    return null;
  }

  try {
    const user = JSON.parse(rawUser) as User;
    return { accessToken, refreshToken, user };
  } catch {
    return null;
  }
}

export function setSession(session: Session) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}
