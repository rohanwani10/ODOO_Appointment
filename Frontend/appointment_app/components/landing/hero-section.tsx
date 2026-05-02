"use client";

import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { HeroVisual } from "./hero-visual";

export function HeroSection() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-32">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_60%,rgba(59,130,246,0.12),transparent)]" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
            <Sparkles className="size-4" />
            Scheduling made simple
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl dark:text-white">
            Schedule meetings{" "}
            <span className="text-primary">without the back-and-forth</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            ZenSchedule connects to your calendar, shows your real-time
            availability, and lets anyone book time with you instantly. No
            more &quot;what time works for you?&quot; emails.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {isLoading ? (
              <Loader2 className="size-8 animate-spin text-primary" />
            ) : isAuthenticated ? (
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground rounded-xl text-lg font-bold hover:opacity-90 transition-opacity shadow-xl shadow-primary/20"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/register"
                  className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground rounded-xl text-lg font-bold hover:opacity-90 transition-opacity shadow-xl shadow-primary/20"
                >
                  Start Scheduling Free
                </Link>
                <Link
                  href="/auth/login"
                  className="w-full sm:w-auto px-8 py-4 bg-secondary text-secondary-foreground rounded-xl text-lg font-bold hover:bg-muted transition-all border border-border"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}
