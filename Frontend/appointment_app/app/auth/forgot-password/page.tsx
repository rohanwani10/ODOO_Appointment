"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      setMessage(
        "If an account exists with that email, we have sent password reset instructions.",
      );
    } catch (err: any) {
      setError(err.message || "Failed to send reset link");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_40%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-white">
          Forgot password
        </h1>
        <p className="mb-8 text-sm text-slate-300">
          Enter your email address and we'll send you a link to reset your
          password.
        </p>

        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
              placeholder="name@example.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !!message}
            className="mt-4 w-full rounded-2xl bg-sky-400 px-4 py-3 font-semibold text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Sending link..." : "Send reset link"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-300">
          Remember your password?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-sky-300 hover:text-sky-200"
          >
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
