"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CalendarDays,
  ShieldCheck,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

type PlanName = "Free" | "Starter" | "Pro";

type PricingRow = {
  label: string;
  free: string | boolean;
  starter: string | boolean;
  pro: string | boolean;
};

type BillingSnapshot = {
  updated_at?: string;
  unavailable_message?: string;
};

const comparisonRows: PricingRow[] = [
  {
    label: "Connected calendars",
    free: "1 calendar",
    starter: "3 calendars",
    pro: "Unlimited",
  },
  {
    label: "Monthly booking limits",
    free: "15 bookings",
    starter: "120 bookings",
    pro: "Unlimited",
  },
  {
    label: "Availability management",
    free: true,
    starter: true,
    pro: true,
  },
  {
    label: "Google Calendar sync",
    free: true,
    starter: true,
    pro: true,
  },
  {
    label: "Custom booking page access",
    free: false,
    starter: true,
    pro: true,
  },
];

const pricingPlans: Array<{
  name: PlanName;
  price: string;
  description: string;
  featured?: boolean;
  features: string[];
  actionLabel: string;
}> = [
  {
    name: "Free",
    price: "$0",
    description:
      "A simple way to test MeetMint and share a clean booking page.",
    features: [
      "1 connected calendar",
      "15 bookings per month",
      "Availability management",
    ],
    actionLabel: "Start free",
  },
  {
    name: "Starter",
    price: "$19",
    description: "For solo operators and small teams that book every day.",
    features: [
      "3 connected calendars",
      "120 bookings per month",
      "Google Calendar sync",
      "Custom booking page access",
    ],
    actionLabel: "Choose Starter",
  },
  {
    name: "Pro",
    price: "$49",
    description:
      "Best for teams that want premium scheduling automation at scale.",
    featured: true,
    features: [
      "Unlimited connected calendars",
      "Unlimited bookings",
      "Advanced availability rules",
      "Google Calendar sync",
      "Custom booking page access",
      "Priority support",
    ],
    actionLabel: "Get Pro",
  },
];

function BrandMark() {
  return (
    <span className="flex size-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 dark:bg-white dark:text-slate-950">
      C
    </span>
  );
}

function Navigation() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/75">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          <BrandMark />
          <span className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
            MeetMint
          </span>
        </Link>

        <nav className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/pricing"
            aria-current="page"
            className="text-sm font-semibold text-slate-950 transition-colors hover:text-slate-700 dark:text-white dark:hover:text-slate-300"
          >
            Pricing
          </Link>
          <Link
            href="/auth/login"
            className="hidden rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-100 sm:inline-flex dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            Get Started
          </Link>
        </nav>
      </div>
    </header>
  );
}

function FeatureIcon({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="size-4 text-emerald-500" />
    ) : (
      <X className="size-4 text-slate-400" />
    );
  }

  return (
    <span className="text-sm font-medium text-slate-900 dark:text-white">
      {value}
    </span>
  );
}

export default function PricingPage() {
  const [billingData, setBillingData] = useState<BillingSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadBillingData() {
      try {
        const data = await apiFetch<BillingSnapshot>("/api/billing/pricing");

        if (!isCancelled) {
          setBillingData(data);
          setFallbackMessage(null);
        }
      } catch {
        if (!isCancelled) {
          setBillingData(null);
          setFallbackMessage(
            "Live billing data is unavailable right now, so the plans below show the current published pricing.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBillingData();

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_38%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_32%,#ffffff_100%)] text-slate-950 dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] dark:text-white">
      <Navigation />

      <main className="pt-28 sm:pt-32">
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              <Sparkles className="size-4 text-sky-500" />
              Pricing built for teams that want clarity
            </div>
            <h1 className="text-balance text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl dark:text-white">
              Simple, transparent pricing.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-slate-600 sm:text-xl dark:text-slate-300">
              Choose a plan that fits your workflow today and move up as your
              scheduling needs grow. No hidden fees, no confusing usage math.
            </p>
            {billingData?.updated_at && (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                Last refreshed {billingData.updated_at}
              </p>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white/80 p-5 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-white/10">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                  Feature comparison
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                  Compare Free, Starter, and Pro at a glance.
                </p>
              </div>
              {isLoading ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  <div className="size-2 rounded-full bg-sky-500 animate-pulse" />
                  Loading billing data
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
                  <ShieldCheck className="size-4" />
                  Published pricing available
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-sm text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3 font-medium">Included feature</th>
                    <th className="px-4 py-3 font-medium">Free</th>
                    <th className="px-4 py-3 font-medium">Starter</th>
                    <th className="px-4 py-3 font-medium">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {(isLoading ? comparisonRows : comparisonRows).map((row) => (
                    <tr
                      key={row.label}
                      className="rounded-2xl bg-slate-50/80 dark:bg-white/[0.03]"
                    >
                      <td className="px-4 py-4 text-sm font-medium text-slate-900 dark:text-white">
                        {row.label}
                      </td>
                      <td className="px-4 py-4">
                        <FeatureIcon value={row.free} />
                      </td>
                      <td className="px-4 py-4">
                        <FeatureIcon value={row.starter} />
                      </td>
                      <td className="px-4 py-4">
                        <FeatureIcon value={row.pro} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {fallbackMessage && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                {fallbackMessage}
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                Product pricing
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">
                Pick the plan that matches your scheduling volume.
              </h2>
            </div>
            <Link
              href="/auth/register"
              className="hidden items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:border-slate-400 hover:bg-white sm:inline-flex dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              Start free
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <article
                key={plan.name}
                className={`relative overflow-hidden rounded-[2rem] border p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_90px_rgba(15,23,42,0.14)] dark:shadow-[0_20px_70px_rgba(2,6,23,0.45)] ${
                  plan.featured
                    ? "border-sky-200 bg-[linear-gradient(180deg,rgba(239,246,255,0.96),rgba(255,255,255,0.92))] ring-1 ring-sky-200 dark:border-sky-400/30 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] dark:ring-sky-400/20"
                    : "border-slate-200 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-white/[0.04]"
                }`}
              >
                {plan.featured && (
                  <div className="absolute right-6 top-6 rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-sky-500/20">
                    Most popular
                  </div>
                )}

                <div className="pr-24">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                    {plan.name}
                  </p>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-5xl font-semibold tracking-tight text-slate-950 dark:text-white">
                      {plan.price}
                    </span>
                    <span className="pb-1 text-sm text-slate-500 dark:text-slate-400">
                      /month
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {plan.description}
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200"
                    >
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/auth/register"
                  className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                    plan.featured
                      ? "bg-slate-950 text-white shadow-[0_14px_35px_rgba(15,23,42,0.22)] hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                      : "border border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                  }`}
                >
                  {plan.actionLabel}
                </Link>
              </article>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <CalendarDays className="size-4 text-sky-500" />
            Flexible upgrades and downgrades are available anytime.
          </div>
        </section>
      </main>
    </div>
  );
}
