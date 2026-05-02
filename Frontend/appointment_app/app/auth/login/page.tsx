"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Lock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import { motion, MotionConfig, useReducedMotion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { LoginResponse } from "@/types/user";
import Link from "next/link";
import { getErrorMessage } from "@/lib/errors";
import { GoogleLoginButton } from "@/components/auth/google-login-button";

type FieldErrors = {
  email?: string;
  password?: string;
};

function validateEmail(input: string): string | undefined {
  const value = input.trim();
  if (!value) return "Email is required.";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) return "Enter a valid email address.";
  return undefined;
}

function getFriendlyGoogleError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("google_client_id") || normalized.includes("client id")) {
    return "Google sign-in is temporarily unavailable due to a configuration issue. Please use email/password for now.";
  }
  if (normalized.includes("popup") || normalized.includes("closed")) {
    return "Google sign-in was canceled. Please try again.";
  }
  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "Unable to reach Google sign-in. Check your internet connection and retry.";
  }
  return "Google sign-in failed. Please retry or continue with email/password.";
}

function AuthAnimatedBackground({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="absolute inset-0 z-0" aria-hidden="true">
      <motion.div
        animate={
          reduceMotion
            ? undefined
            : {
                scale: [1, 1.2, 1],
                rotate: [0, 90, 0],
                opacity: [0.1, 0.2, 0.1],
              }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 20, repeat: Infinity, ease: [0, 0, 1, 1] as const }
        }
        className="absolute -left-40 -top-40 size-[600px] rounded-full bg-primary/20 blur-[120px]"
      />
      <motion.div
        animate={
          reduceMotion
            ? undefined
            : {
                scale: [1, 1.1, 1],
                rotate: [0, -45, 0],
                opacity: [0.05, 0.15, 0.05],
              }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 15, repeat: Infinity, ease: [0, 0, 1, 1] as const }
        }
        className="absolute -bottom-40 -right-40 size-[500px] rounded-full bg-indigo-500/20 blur-[100px]"
      />
      <div className="absolute inset-0 bg-dashboard-grid opacity-20" />
    </div>
  );
}

function LoginPageFallback() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-white">
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-sky-400" />
      </div>
    </div>
  );
}

function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();
  const { refreshUser } = useAuth();
  const emailInputRef = useRef<HTMLInputElement>(null);

  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    return next && next.startsWith("/") ? next : "/dashboard";
  }, [searchParams]);

  const runValidation = (): FieldErrors => {
    const emailError = validateEmail(email);
    const passwordError = password.trim() ? undefined : "Password is required.";
    return { email: emailError, password: passwordError };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = runValidation();
    setFieldErrors(validation);
    setError("");
    setSuccessMessage("");

    if (validation.email || validation.password) {
      return;
    }

    setIsLoading(true);

    try {
      const data = await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      setTokens(data.access_token, data.refresh_token);
      await refreshUser();
      setSuccessMessage("Signed in successfully. Redirecting...");
      await new Promise((resolve) => setTimeout(resolve, 700));
      router.replace(nextPath);
    } catch (err) {
      setError(
        `${getErrorMessage(err, "Failed to login")}. Please check your credentials and try again.`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-hidden bg-background text-white selection:bg-primary/30">
        <AuthAnimatedBackground reduceMotion={!!shouldReduceMotion} />

        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-slate-950/20 backdrop-blur-md">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
            <Link
              href="/"
              className="group flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span className="flex size-10 items-center justify-center rounded-2xl bg-white text-sm font-bold text-slate-950 shadow-xl transition-transform group-hover:rotate-12">
                C
              </span>
              <span className="text-xl font-bold tracking-tight">Calvero</span>
            </Link>
            <nav className="flex items-center gap-4 sm:gap-6">
              <Link
                href="/pricing"
                className="rounded-md text-sm font-semibold text-slate-200 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Pricing
              </Link>
              <Link
                href="/auth/register"
                className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950 transition-all hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:px-5"
              >
                Get Started
              </Link>
            </nav>
          </div>
        </header>

        <main className="relative z-10 flex min-h-screen items-center justify-center px-4 pt-24 sm:px-6">
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.5, ease: [0, 0, 0.58, 1] as const }}
            className="w-full max-w-md"
          >
            <div className="mb-6 flex justify-center sm:mb-8">
              <div className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary shadow-2xl">
                <Sparkles className="size-3.5" />
                Intelligence Awaits
              </div>
            </div>

            <div className="mb-6 text-center sm:mb-8">
              <h1 className="text-gradient text-3xl font-bold tracking-tight sm:text-5xl">
                Sign In
              </h1>
              <p className="mt-3 text-sm text-slate-200 sm:text-base">
                Access your premium scheduling suite.
              </p>
            </div>

            <section
              aria-label="Sign in form"
              className="glass-premium rounded-[32px] p-6 shadow-2xl sm:rounded-[40px] sm:p-8"
            >
              {error && (
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
                  className="mb-4"
                  role="alert"
                  aria-live="polite"
                >
                  <div className="rounded-2xl border border-rose-400/45 bg-rose-950/45 p-4 text-rose-50">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-200" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">Sign-in failed</p>
                        <p className="text-sm leading-5 text-rose-100/95">{error}</p>
                        <p className="text-xs text-rose-100/90">Please retry. If this keeps happening, refresh the page.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        emailInputRef.current?.focus();
                      }}
                      className="mt-3 inline-flex rounded-lg border border-rose-200/60 px-3 py-1.5 text-xs font-semibold text-rose-50 transition hover:bg-rose-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 focus-visible:ring-offset-2 focus-visible:ring-offset-rose-950/80"
                    >
                      Dismiss and retry
                    </button>
                  </div>
                </motion.div>
              )}

              {successMessage && (
                <div className="mb-4 rounded-2xl border border-emerald-300/45 bg-emerald-900/45 p-4" aria-live="polite">
                  <div className="flex items-start gap-3 text-emerald-50">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-200" />
                    <p className="text-sm font-semibold">{successMessage}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="ml-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-200"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-300" />
                    <input
                      ref={emailInputRef}
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) {
                          setFieldErrors((prev) => ({ ...prev, email: validateEmail(e.target.value) }));
                        }
                      }}
                      onBlur={() => {
                        setFieldErrors((prev) => ({ ...prev, email: validateEmail(email) }));
                      }}
                      aria-invalid={!!fieldErrors.email}
                      aria-describedby={fieldErrors.email ? "email-error" : undefined}
                      disabled={isLoading}
                      className="h-12 w-full rounded-2xl border border-white/15 bg-white/10 py-3 pl-12 pr-4 text-white placeholder:text-slate-300/80 outline-none transition focus-visible:border-primary/90 focus-visible:ring-2 focus-visible:ring-primary/75 disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder="name@example.com"
                    />
                  </div>
                  {fieldErrors.email ? (
                    <p id="email-error" className="ml-1 text-sm text-rose-200" role="alert">
                      {fieldErrors.email}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="ml-1 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="text-xs font-bold uppercase tracking-[0.14em] text-slate-200"
                    >
                      Password
                    </label>
                    <Link
                      href="/auth/forgot-password"
                      className="rounded-md text-xs font-semibold text-primary transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                    >
                      Forgot?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-300" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            password: e.target.value.trim() ? undefined : "Password is required.",
                          }));
                        }
                      }}
                      onBlur={() => {
                        setFieldErrors((prev) => ({
                          ...prev,
                          password: password.trim() ? undefined : "Password is required.",
                        }));
                      }}
                      aria-invalid={!!fieldErrors.password}
                      aria-describedby={fieldErrors.password ? "password-error" : undefined}
                      disabled={isLoading}
                      className="h-12 w-full rounded-2xl border border-white/15 bg-white/10 py-3 pl-12 pr-12 text-white placeholder:text-slate-300/80 outline-none transition focus-visible:border-primary/90 focus-visible:ring-2 focus-visible:ring-primary/75 disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      disabled={isLoading}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {fieldErrors.password ? (
                    <p id="password-error" className="ml-1 text-sm text-rose-200" role="alert">
                      {fieldErrors.password}
                    </p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative mt-2 h-12 w-full overflow-hidden rounded-2xl bg-white font-bold text-slate-950 transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </span>
                  {isLoading ? (
                    <span className="absolute inset-x-0 bottom-0 h-1 animate-pulse bg-slate-900/20" aria-hidden="true" />
                  ) : null}
                </button>
              </form>

              <div className="mt-4">
                <GoogleLoginButton
                  onSuccess={async () => {
                    await refreshUser();
                    router.replace(nextPath);
                  }}
                  onError={(msg) => setError(getFriendlyGoogleError(msg))}
                  className="h-12 w-full rounded-2xl border border-white/20 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white"
                />
              </div>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-slate-900/60 px-3 text-slate-100">
                    New to Calvero?
                  </span>
                </div>
              </div>

              <Link
                href="/auth/register"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                Create an account
              </Link>
            </section>
          </motion.div>
        </main>
      </div>
    </MotionConfig>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
