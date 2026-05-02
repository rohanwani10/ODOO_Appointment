"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_40%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-white">
          Join us
        </h1>
        <p className="mb-8 text-sm text-slate-300">
          How would you like to use the platform? You can always change this
          later.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Customer card */}
          <button
            onClick={() => router.push("/auth/register/customer")}
            className="group relative flex flex-col items-start gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-6 text-left transition-all hover:border-sky-400/40 hover:bg-sky-500/10 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300 transition-colors group-hover:bg-sky-400/25">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Customer</h2>
              <p className="mt-1 text-sm text-slate-400">
                Browse services and book appointments with providers.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium uppercase tracking-widest text-sky-300/80 transition-colors group-hover:text-sky-200">
              Continue
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </span>
          </button>

          {/* Organizer card */}
          <button
            onClick={() => router.push("/auth/register/organizer")}
            className="group relative flex flex-col items-start gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-6 text-left transition-all hover:border-violet-400/40 hover:bg-violet-500/10 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-400/15 text-violet-300 transition-colors group-hover:bg-violet-400/25">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
                <path d="m9 16 2 2 4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Organizer</h2>
              <p className="mt-1 text-sm text-slate-400">
                Create services, manage resources, and accept bookings.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium uppercase tracking-widest text-violet-300/80 transition-colors group-hover:text-violet-200">
              Continue
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </span>
          </button>
        </div>

        <p className="mt-8 text-center text-sm text-slate-300">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-sky-300 hover:text-sky-200"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
