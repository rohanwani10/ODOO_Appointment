"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/auth/auth-guard";
import { apiFetch } from "@/lib/api";

export default function DashboardPage() {
  const { user, isAdmin, isOrganizer, logout } = useAuth();
  const router = useRouter();
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  const sendOtp = async () => {
    if (!user?.email) {
      return;
    }

    setStatus(null);
    setIsSendingOtp(true);

    try {
      await apiFetch("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ email: user.email }),
      });
      setStatus("OTP sent. Check your inbox and use the verification page.");
    } catch (error: any) {
      setStatus(error.message || "Unable to send OTP.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  return (
    <AuthGuard>
      <div className="space-y-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-950/20 backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-sky-300/80">
                Signed in
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">
                Welcome back, {user?.first_name}
              </h1>
              <p className="mt-3 max-w-2xl text-slate-300">
                This dashboard mirrors the backend state: your verified status,
                roles, and account actions.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/settings"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
              >
                Edit profile
              </Link>
              <Link
                href="/auth/verify-otp"
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Verify email
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-400/20"
                >
                  Admin users
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Logout
              </button>
            </div>
          </div>
        </section>

        {status && (
          <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            {status}
          </div>
        )}

        {!user?.is_verified && (
          <section className="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-6 text-amber-50">
            <h2 className="text-lg font-semibold">
              Email verification pending
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-amber-100/90">
              Send an OTP to the email address on this account, then verify it
              from the OTP page.
            </p>
            <button
              onClick={sendOtp}
              disabled={isSendingOtp}
              className="mt-4 rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSendingOtp ? "Sending OTP..." : "Send OTP"}
            </button>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Role
            </p>
            <p className="mt-3 text-xl font-semibold text-white">
              {user?.roles?.join(", ") || "CUSTOMER"}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Verification
            </p>
            <p className="mt-3 text-xl font-semibold text-white">
              {user?.is_verified ? "Verified" : "Pending"}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Account
            </p>
            <p className="mt-3 text-xl font-semibold text-white">
              {user?.is_active ? "Active" : "Inactive"}
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold text-white">
              Profile snapshot
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Email
                </dt>
                <dd className="mt-1 text-sm text-slate-100">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Phone
                </dt>
                <dd className="mt-1 text-sm text-slate-100">
                  {user?.phone || "Not set"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  First name
                </dt>
                <dd className="mt-1 text-sm text-slate-100">
                  {user?.first_name}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Last name
                </dt>
                <dd className="mt-1 text-sm text-slate-100">
                  {user?.last_name}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
            <h2 className="text-lg font-semibold text-white">Next steps</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>Update your profile in Settings.</li>
              <li>Verify email if the OTP step is still pending.</li>
              <li>Admins can manage roles and deactivate users.</li>
            </ul>
          </div>
        </section>
      </div>
    </AuthGuard>
  );
}
