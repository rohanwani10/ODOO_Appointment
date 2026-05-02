import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_35%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#111827_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-sky-300/80">
              Appointment Booking System
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Backend-first frontend
            </h1>
          </div>
          <div className="flex gap-3 text-sm">
            <Link
              href="/auth/login"
              className="rounded-full border border-white/15 px-4 py-2 text-white/85 transition-colors hover:bg-white/10"
            >
              Login
            </Link>
            <Link
              href="/auth/register"
              className="rounded-full bg-sky-400 px-4 py-2 font-medium text-slate-950 transition-colors hover:bg-sky-300"
            >
              Register
            </Link>
          </div>
        </header>

        <main className="flex flex-1 items-center py-16">
          <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="inline-flex rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-sky-200">
                FastAPI auth + RBAC
              </p>
              <h2 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">
                Clean session flow, profile management, and admin user controls.
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                This frontend is trimmed to the backend you actually have:
                register, login, OTP verification, password reset, user profile
                updates, and admin role management.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/dashboard"
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
                >
                  Open dashboard
                </Link>
                <Link
                  href="/auth/verify-otp"
                  className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Verify email
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-sky-950/20 backdrop-blur">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Auth
                  </p>
                  <p className="mt-3 text-lg font-semibold">
                    Register, login, refresh tokens
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Profile
                  </p>
                  <p className="mt-3 text-lg font-semibold">
                    Update details and password
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    RBAC
                  </p>
                  <p className="mt-3 text-lg font-semibold">
                    Admin-only user management
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Email
                  </p>
                  <p className="mt-3 text-lg font-semibold">
                    OTP and reset-password flows
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
