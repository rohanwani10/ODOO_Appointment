import { getAccessToken, getRefreshToken, setTokens, removeTokens } from './auth';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

type FetchOptions = RequestInit & {
  params?: Record<string, string>;
};

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.map((cb) => cb(token));
  refreshSubscribers = [];
}

async function readApiError(response: Response) {
  const fallback = `API Error: ${response.status}`;

  try {
    const data = await response.json();

    if (typeof data?.detail === 'string') {
      return data.detail;
    }

    if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
      return data.detail[0].msg;
    }

    if (typeof data?.message === 'string') {
      return data.message;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

async function readApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...init } = options;

  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const accessToken = getAccessToken();
  const refreshTokenValue = getRefreshToken();

  const headers = new Headers(init.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...init,
      headers,
    });

    const shouldAttemptRefresh =
      response.status === 401 &&
      Boolean(accessToken) &&
      Boolean(refreshTokenValue) &&
      !endpoint.includes('/api/auth/login') &&
      !endpoint.includes('/api/auth/register') &&
      !endpoint.includes('/api/auth/refresh-token') &&
      !endpoint.includes('/api/auth/forgot-password') &&
      !endpoint.includes('/api/auth/reset-password') &&
      !endpoint.includes('/api/auth/send-otp') &&
      !endpoint.includes('/api/auth/verify-otp');

    if (response.status === 401 && shouldAttemptRefresh) {

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshTokenValue }),
          });

          if (refreshResponse.ok) {
            const data = await refreshResponse.json();
            setTokens(data.access_token, data.refresh_token);
            isRefreshing = false;
            onRefreshed(data.access_token);

            // The INITIATING request retries directly with the new token
            // instead of subscribing to a notification that already fired.
            headers.set('Authorization', `Bearer ${data.access_token}`);
            const retryResponse = await fetch(url, { ...init, headers });
            if (!retryResponse.ok) {
              throw new Error(await readApiError(retryResponse));
            }
            return readApiResponse<T>(retryResponse);
          } else {
            isRefreshing = false;
            removeTokens();
            if (typeof window !== 'undefined') {
              window.location.href = '/auth/login';
            }
            throw new Error('Session expired');
          }
        } catch (error) {
          isRefreshing = false;
          removeTokens();
          throw error;
        }
      }

      // Only QUEUED requests (not the initiator) wait here
      return new Promise<T>((resolve, reject) => {
        subscribeTokenRefresh((newToken) => {
          headers.set('Authorization', `Bearer ${newToken}`);
          fetch(url, { ...init, headers })
            .then(async (res) => {
              if (!res.ok) {
                throw new Error(await readApiError(res));
              }
              return readApiResponse<T>(res);
            })
            .then(resolve)
            .catch(reject);
        });
      });
    }

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    return readApiResponse<T>(response);
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}
