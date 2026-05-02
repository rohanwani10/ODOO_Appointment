"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Loader2,
  ArrowRight,
  Mail,
  Lock,
  User,
  Phone,
  ArrowLeft,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { LoginResponse, UserRole } from "@/types/user";
import Link from "next/link";
import { GoogleLoginButton } from "./google-login-button";

interface RegisterFormProps {
  role: UserRole;
  accentColor: string;
  heading: string;
  subtitle: string;
}

export default function RegisterForm({
  role,
  accentColor,
  heading,
  subtitle,
}: RegisterFormProps) {
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { refreshUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const payload = {
        ...formData,
        email: formData.email.trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone: formData.phone.trim() || null,
        role,
      };

      const data = await apiFetch<LoginResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setTokens(data.access_token, data.refresh_token);
      await refreshUser();
      router.push(
        `/auth/verify-otp?email=${encodeURIComponent(payload.email)}`,
      );
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Dynamic color mappings
  const accentColorMap = {
    sky: {
      badge:
        "border-sky-300/30 bg-sky-100 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-300",
      button:
        "bg-sky-600 hover:bg-sky-700 text-white dark:bg-sky-600 dark:hover:bg-sky-700",
      focus:
        "focus:border-sky-500 focus:ring-sky-500/20 dark:focus:border-sky-400 dark:focus:ring-sky-400/20",
    },
    violet: {
      badge:
        "border-violet-300/30 bg-violet-100 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-300",
      button:
        "bg-violet-600 hover:bg-violet-700 text-white dark:bg-violet-600 dark:hover:bg-violet-700",
      focus:
        "focus:border-violet-500 focus:ring-violet-500/20 dark:focus:border-violet-400 dark:focus:ring-violet-400/20",
    },
  };

  const colors =
    accentColorMap[accentColor as keyof typeof accentColorMap] ||
    accentColorMap.sky;

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
              MeetMint
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
              href="/auth/login"
              className="hidden rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-100 sm:inline-flex dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex min-h-screen items-center justify-center pt-20">
        <div className="w-full max-w-lg px-4 py-12">
          {/* Back Button */}
          <Link
            href="/auth/register"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Change role
          </Link>

          {/* Role Badge */}
          <div className="mb-8 inline-flex items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] ${colors.badge}`}
            >
              {role === "CUSTOMER" ? "🧑 Customer" : "📅 Organizer"}
            </span>
          </div>

          {/* Heading */}
          <div className="mb-10">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {heading}
            </h1>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
              {subtitle}
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
              {/* First Name & Last Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2.5 block text-sm font-semibold text-slate-900 dark:text-white">
                    First name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none dark:text-slate-500" />
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      className={`w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-slate-900 outline-none transition-all placeholder:text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-400 ${colors.focus}`}
                      placeholder="John"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2.5 block text-sm font-semibold text-slate-900 dark:text-white">
                    Last name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none dark:text-slate-500" />
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      className={`w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-slate-900 outline-none transition-all placeholder:text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-400 ${colors.focus}`}
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-2.5 block text-sm font-semibold text-slate-900 dark:text-white">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none dark:text-slate-500" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-slate-900 outline-none transition-all placeholder:text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-400 ${colors.focus}`}
                    placeholder="name@example.com"
                    required
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="mb-2.5 block text-sm font-semibold text-slate-900 dark:text-white">
                  Phone{" "}
                  <span className="text-slate-400 dark:text-slate-500">
                    (optional)
                  </span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none dark:text-slate-500" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className={`w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-slate-900 outline-none transition-all placeholder:text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-400 ${colors.focus}`}
                    placeholder="+1234567890"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-2.5 block text-sm font-semibold text-slate-900 dark:text-white">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none dark:text-slate-500" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-slate-900 outline-none transition-all placeholder:text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-400 ${colors.focus}`}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`mt-8 w-full inline-flex items-center justify-center rounded-full px-7 py-3 text-base font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70 disabled:shadow-none ${colors.button}`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create account
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
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-300 dark:border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-3 text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
                  Already have an account?
                </span>
              </div>
            </div>

            {/* Sign In Link */}
            <Link
              href="/auth/login"
              className="w-full inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/80 px-7 py-3 text-base font-semibold text-slate-900 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              Sign in instead
            </Link>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            By signing up, you agree to our{" "}
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
