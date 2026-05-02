"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { attachRoles, setSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import type { AuthResponse } from "@/lib/types";

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("Missing Google authorization code.");
      return;
    }

    let active = true;

    async function completeGoogleLogin() {
      try {
        const response = await apiFetch<AuthResponse>("/api/auth/google/callback", {
          method: "POST",
          skipAuth: true,
          body: JSON.stringify({ code }),
        });

        if (!active) {
          return;
        }

        setSession({
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
          user: attachRoles(response.user, response.access_token),
        });
        window.location.replace("/dashboard");
      } catch (callbackError) {
        if (active) {
          setError(callbackError instanceof Error ? callbackError.message : "Google login failed");
        }
      }
    }

    void completeGoogleLogin();
    return () => {
      active = false;
    };
  }, [router, searchParams]);

  return (
    <section className="panel">
      <h1>Google callback</h1>
      {error ? <p className="error">{error}</p> : <p>Completing Google sign-in...</p>}
    </section>
  );
}

export default function GoogleCallbackPage() {
  return (
    <div className="page">
      <Suspense fallback={<p>Loading Google callback...</p>}>
        <GoogleCallbackContent />
      </Suspense>
    </div>
  );
}
