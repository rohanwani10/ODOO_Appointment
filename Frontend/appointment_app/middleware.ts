import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware that adds the `bypass-tunnel-reminder` header to every
 * /api/* request so localtunnel doesn't serve its interstitial HTML page
 * (which causes a 503 from the rewrite proxy).
 *
 * When the backend is NOT behind localtunnel this header is harmless.
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("bypass-tunnel-reminder", "true");

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: "/api/:path*",
};
