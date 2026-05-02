"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  LogIn,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { LoginResponse } from "@/types/user";
import Link from "next/link";
import { getErrorMessage } from "@/lib/errors";
import { GoogleLoginButton } from "@/components/auth/google-login-button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { refreshUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const data = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setTokens(data.access_token, data.refresh_token);
      await refreshUser();
      const nextPath =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null;
      router.push(
        nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard",
      );
    } catch (err) {
      setError(getErrorMessage(err, "Failed to login"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.08),transparent_42%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_36%,#ffffff_100%)] text-slate-950 dark:bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_32%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] dark:text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 dark:bg-white dark:text-slate-950">
              C
            </span>
            <span className="text-lg font-semibold tracking-tight">
              Calvero
            </span>
          </Link>
          <nav className="flex items-center gap-3 sm:gap-5">
            <Link
              href="/pricing"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
            >
              Pricing
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex min-h-screen items-center justify-center pt-20">
        <div className="w-full max-w-lg px-4 py-12">
          {/* Intro Badge */}
          <div className="mb-8 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/75 px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              <LogIn className="size-4 text-slate-500 dark:text-slate-400" />
              Welcome to Calvero
            </div>
          </div>

          {/* Heading */}
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Sign in to your account
            </h1>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
              Access your bookings, calendar sync, and scheduling tools.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 flex items-start gap-3 dark:border-red-400/30 dark:bg-red-500/10">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {error}
              </p>
            </div>
          )}

          {/* Form Card */}
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-white/[0.04] sm:p-10">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div>
                <label className="mb-2.5 block text-sm font-semibold text-slate-900 dark:text-white">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 pointer-events-none dark:text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white pl-12 pr-4 py-2.5 text-slate-900 outline-none transition-all placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-sky-400 dark:focus:ring-sky-400/20"
                    placeholder="name@example.com"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                    Password
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs text-sky-600 hover:text-sky-700 transition-colors dark:text-sky-400 dark:hover:text-sky-300"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 pointer-events-none dark:text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white pl-12 pr-4 py-2.5 text-slate-900 outline-none transition-all placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-sky-400 dark:focus:ring-sky-400/20"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="mt-8 w-full inline-flex items-center justify-center rounded-full bg-slate-950 px-7 py-3 text-base font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-0.5 hover:bg-slate-800 disabled:translate-y-0 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 dark:disabled:bg-white/20 dark:disabled:text-slate-500"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="ml-2 size-4" />
                  </>
                )}
              </button>
            </form>

            {/* Google Sign-In Button */}
            <div className="mt-6">
              <GoogleLoginButton
                onSuccess={() => {
                  router.push("/dashboard");
                }}
                onError={setError}
                className="w-full"
              />
            </div>

            {/* Divider */}
            <div className="relative mt-6 mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-300 dark:border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-3 text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
                  New to Calvero?
                </span>
              </div>
            </div>

            {/* Signup Link */}
            <Link
              href="/auth/register"
              className="w-full inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/80 px-7 py-3 text-base font-semibold text-slate-900 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              Create account
            </Link>
          </div>

          {/* Footer Info */}
          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            By signing in, you agree to our{" "}
            <Link
              href="#"
              className="font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="#"
              className="font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
