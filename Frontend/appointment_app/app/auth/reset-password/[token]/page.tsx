"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token. Please check your email link.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setError("Passwords do not match.");
    }
    if (password.length < 8) {
      return setError("Password must be at least 8 characters long.");
    }

    setIsLoading(true);
    setError("");

    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token,
          new_password: password,
        }),
      });

      setSuccess(true);
      setTimeout(() => {
        router.push("/auth/login");
      }, 3000);
    } catch (err: any) {
      setError(
        err.message || "Failed to reset password. The link may have expired.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_40%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] p-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-white">
            Set new password
          </h1>
          <p className="mb-8 text-sm text-slate-300">
            Choose a strong password for your account.
          </p>
          <div className="w-16 h-16 bg-emerald-500/15 text-emerald-300 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            ✓
          </div>
          <h1 className="text-2xl font-bold mb-2 text-white">
            Password updated
          </h1>
          <p className="text-slate-300 mb-8">
            Your account is now secure. We're redirecting you to the login page.
          </p>
          <Link
            href="/auth/login"
            className="inline-block rounded-2xl bg-sky-400 px-6 py-3 font-medium text-slate-950 transition-colors hover:bg-sky-300"
          >
            Login Now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_40%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-white">
          Set new password
        </h1>
        <p className="mb-8 text-sm text-slate-300">
          Please choose a strong password that you haven't used before.
        </p>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-slate-200">
              New password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 pr-12 text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[34px] text-xs font-medium text-slate-400 transition-colors hover:text-white"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">
              Confirm new password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !token}
            className="mt-4 w-full rounded-2xl bg-sky-400 px-4 py-3 font-semibold text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Updating password..." : "Save password"}
          </button>
        </form>
      </div>
    </div>
  );
}
