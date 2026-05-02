"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Calendar, ArrowRight } from "lucide-react";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();

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
              href="/auth/login"
              className="hidden rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-100 sm:inline-flex dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex min-h-screen items-center justify-center pt-20">
        <div className="w-full max-w-2xl px-4 py-12">
          {/* Intro Badge */}
          <div className="mb-8 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/75 px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              <Users className="size-4 text-slate-500 dark:text-slate-400" />
              Get started with Calvero
            </div>
          </div>

          {/* Heading */}
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
              Choose your role
            </h1>
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
              Select how you want to use Calvero. You can always change this
              later.
            </p>
          </div>

          {/* Role Selection Cards */}
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Customer Card */}
            <button
              onClick={() => router.push("/auth/register/customer")}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_24px_80px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-sky-400/30 dark:hover:bg-sky-500/10 focus:outline-none"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.15),transparent_38%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative">
                <div className="mb-6 flex size-14 items-center justify-center rounded-2xl border border-slate-200 bg-sky-50 text-sky-600 shadow-lg shadow-sky-500/10 transition-all group-hover:border-sky-300 group-hover:bg-sky-100 group-hover:shadow-sky-500/20 dark:border-white/10 dark:bg-sky-500/10 dark:text-sky-300 dark:group-hover:bg-sky-500/20 dark:group-hover:border-sky-400/50">
                  <Users className="size-6" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  Customer
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Browse services and book appointments with providers. Get
                  confirmations and calendar integration.
                </p>
                <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-sky-600 group-hover:text-sky-700 dark:text-sky-400 dark:group-hover:text-sky-300">
                  Continue
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </button>

            {/* Organizer Card */}
            <button
              onClick={() => router.push("/auth/register/organizer")}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_24px_80px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-violet-400/30 dark:hover:bg-violet-500/10 focus:outline-none"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.15),transparent_38%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative">
                <div className="mb-6 flex size-14 items-center justify-center rounded-2xl border border-slate-200 bg-violet-50 text-violet-600 shadow-lg shadow-violet-500/10 transition-all group-hover:border-violet-300 group-hover:bg-violet-100 group-hover:shadow-violet-500/20 dark:border-white/10 dark:bg-violet-500/10 dark:text-violet-300 dark:group-hover:bg-violet-500/20 dark:group-hover:border-violet-400/50">
                  <Calendar className="size-6" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  Organizer
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Create services, manage availability, and accept bookings.
                  Sync with Google Calendar.
                </p>
                <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-violet-600 group-hover:text-violet-700 dark:text-violet-400 dark:group-hover:text-violet-300">
                  Continue
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </button>
          </div>

          {/* Sign In Link */}
          <div className="mt-8 text-center">
            <p className="text-slate-600 dark:text-slate-300">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="font-semibold text-sky-600 hover:text-sky-700 transition-colors dark:text-sky-400 dark:hover:text-sky-300"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
