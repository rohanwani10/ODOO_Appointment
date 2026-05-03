"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setTokens } from "@/lib/auth";

export function GoogleCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasSubmittedCode = useRef(false);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get("code");
        const state = searchParams.get("state");

        if (!code) {
          throw new Error("No authorization code received from Google");
        }
        if (hasSubmittedCode.current) {
          return;
        }
        hasSubmittedCode.current = true;

        // Exchange code for tokens
        const response = await apiFetch<{
          access_token: string;
          refresh_token: string;
          token_type: string;
          user: any;
        }>("/api/auth/google/callback", {
          method: "POST",
          body: JSON.stringify({ code, state }),
        });

        // Store tokens
        setTokens(response.access_token, response.refresh_token);

        // Redirect to dashboard
        router.push("/dashboard");
      } catch (err) {
        console.error("Google callback error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to complete Google authentication",
        );
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (isProcessing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-gray-600">Signing you in with Google...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Authentication Failed
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/auth/login"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return null;
}
