"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function VerifyOtpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const query = new URLSearchParams(window.location.search);
    const emailParam = query.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, []);

  const sendOtp = async () => {
    if (!email) {
      setError("Enter an email address first.");
      return;
    }

    setError("");
    setMessage("");
    setSendingOtp(true);

    try {
      await apiFetch("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage("OTP sent. Check your inbox.");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP.");
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setVerifyingOtp(true);

    try {
      await apiFetch("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      });
      setMessage("Email verified successfully. Redirecting to dashboard...");
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err: any) {
      setError(err.message || "Failed to verify OTP.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_40%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-white">
          Verify OTP
        </h1>
        <p className="mb-8 text-sm text-slate-300">
          Send and verify the email OTP used by the backend.
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

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
              placeholder="name@example.com"
            />
          </div>

          <button
            type="button"
            onClick={sendOtp}
            disabled={sendingOtp}
            className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sendingOtp ? "Sending OTP..." : "Send OTP"}
          </button>

          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">
                OTP code
              </label>
              <input
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
                placeholder="123456"
                required
              />
            </div>

            <button
              type="submit"
              disabled={verifyingOtp}
              className="w-full rounded-2xl bg-sky-400 px-4 py-3 font-semibold text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifyingOtp ? "Verifying..." : "Verify OTP"}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-sm text-slate-300">
          Back to{" "}
          <Link
            href="/dashboard"
            className="font-medium text-sky-300 hover:text-sky-200"
          >
            dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
