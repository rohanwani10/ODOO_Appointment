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
  const fallback = `Request failed with status ${response.status}`;

  try {
    const text = await response.text();
    let data: unknown = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        const conciseText = text.length > 500 ? `${text.slice(0, 500)}...` : text;
        throw new Error(conciseText || fallback);
      }
    }

    const detail =
      data && typeof data === "object" && "detail" in data && typeof data.detail === "string"
        ? data.detail
        : data && typeof data === "object" && "message" in data && typeof data.message === "string"
          ? data.message
          : "Request failed";

    throw new Error(detail);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error(fallback);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const conciseText = text.length > 500 ? `${text.slice(0, 500)}...` : text;
    throw new Error(`Expected JSON response but received: ${conciseText}`);
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

      const data = await parseResponse<AuthResponse>(response);
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

  return parseResponse<T>(response);
}
