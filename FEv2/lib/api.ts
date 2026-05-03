import { attachRoles, clearSession, getSession, setSession } from "@/lib/session";
import type { AuthResponse } from "@/lib/types";

type ApiOptions = RequestInit & {
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;

function buildUrl(path: string, params?: ApiOptions["params"]) {
  const url = new URL(path, typeof window === "undefined" ? "http://localhost:3000" : window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return `${url.pathname}${url.search}`;
}

async function parseError(response: Response) {
  try {
    const data = await response.json();
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : typeof data?.message === "string"
          ? data.message
          : "Request failed";

    throw new Error(detail);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error(`Request failed with status ${response.status}`);
  }
}

async function refreshTokens() {
  const currentSession = getSession();
  if (!currentSession?.refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch("/api/auth/refresh-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: currentSession.refreshToken }),
      });

      if (!response.ok) {
        clearSession();
        return null;
      }

      const data = (await response.json()) as AuthResponse;
      const nextSession = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        user: attachRoles(data.user, data.access_token),
      };
      setSession(nextSession);
      return nextSession.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { params, skipAuth, headers, ...init } = options;
  const session = getSession();
  const requestHeaders = new Headers(headers);
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;

  if (!requestHeaders.has("Content-Type") && init.body && !isFormData) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (!skipAuth && session?.accessToken) {
    requestHeaders.set("Authorization", `Bearer ${session.accessToken}`);
  }

  let response = await fetch(buildUrl(path, params), {
    ...init,
    headers: requestHeaders,
  });

  if (response.status === 401 && !skipAuth) {
    const nextAccessToken = await refreshTokens();
    if (nextAccessToken) {
      requestHeaders.set("Authorization", `Bearer ${nextAccessToken}`);
      response = await fetch(buildUrl(path, params), {
        ...init,
        headers: requestHeaders,
      });
    }
  }

  if (!response.ok) {
    await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
