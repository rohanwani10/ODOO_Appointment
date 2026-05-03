import type { UserRole } from "@/lib/types";

type JwtPayload = {
  user_id?: number;
  email?: string;
  roles?: UserRole[];
  exp?: number;
};

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  if (typeof window !== "undefined" && typeof window.atob === "function") {
    return window.atob(padded);
  }

  return Buffer.from(padded, "base64").toString("utf-8");
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }

    return JSON.parse(decodeBase64Url(payload)) as JwtPayload;
  } catch {
    return null;
  }
}

export function getRolesFromToken(token: string): UserRole[] {
  return decodeJwt(token)?.roles ?? [];
}

export function isTokenExpired(token: string) {
  const exp = decodeJwt(token)?.exp;
  if (!exp) {
    return true;
  }

  return exp * 1000 <= Date.now();
}
