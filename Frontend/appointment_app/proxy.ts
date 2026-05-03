import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Adds the localtunnel bypass header to proxied API requests so rewrites do
 * not receive the interstitial HTML page instead of backend JSON.
 */
export function proxy(request: NextRequest) {
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
