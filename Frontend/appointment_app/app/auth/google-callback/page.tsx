"use client";

import { useSearchParams } from "next/navigation";
import { GoogleCallbackHandler } from "@/components/auth/google-callback-handler";

export default function GoogleCallbackPage() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-md w-full">
        {error ? (
          <div className="rounded-lg border border-red-300 bg-red-50 p-6 text-center dark:border-red-400/30 dark:bg-red-500/10">
            <h2 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">
              Authentication Failed
            </h2>
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        ) : code ? (
          <GoogleCallbackHandler />
        ) : (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-300">
              Processing authentication...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
