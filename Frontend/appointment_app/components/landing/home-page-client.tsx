"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  motion,
  MotionConfig,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CalendarRange,
  Clock3,
  Globe,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Video,
  Wand2,
} from "lucide-react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { AvailableSlot, Service } from "@/types/service";
import { FeatureCard } from "./feature-card";
import { StatCard } from "./stat-card";

const TestimonialsCarousel = dynamic(
  () =>
    import("./testimonials-carousel").then(
      (module) => module.TestimonialsCarousel,
    ),
  {
    ssr: false,
    loading: () => <TestimonialsSkeleton />,
  },
);

type AvailabilityDay = {
  date: Date;
  key: string;
  weekday: string;
  dayNumber: string;
  slots: number;
  isToday: boolean;
  isWeekend: boolean;
};

const demoServices: Service[] = [
  {
    id: 901,
    organization_id: 1,
    name: "Founder strategy session",
    description:
      "A focused planning call for discovery, scope, and next actions.",
    duration_minutes: 30,
    capacity: 1,
    is_published: true,
    shareable_link: "founder-strategy-session",
    max_bookings_per_user: 2,
    requires_advance_payment: false,
    advance_payment_amount: null,
    created_by: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 902,
    organization_id: 1,
    name: "Weekly team review",
    description:
      "A structured recurring checkpoint for internal or client-facing teams.",
    duration_minutes: 45,
    capacity: 1,
    is_published: true,
    shareable_link: "weekly-team-review",
    max_bookings_per_user: 1,
    requires_advance_payment: false,
    advance_payment_amount: null,
    created_by: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 903,
    organization_id: 1,
    name: "Premium onboarding consult",
    description:
      "A longer kickoff with agenda capture, setup guidance, and handoff notes.",
    duration_minutes: 60,
    capacity: 2,
    is_published: true,
    shareable_link: "premium-onboarding-consult",
    max_bookings_per_user: 1,
    requires_advance_payment: true,
    advance_payment_amount: 49,
    created_by: 1,
    created_at: new Date().toISOString(),
  },
];

function createDemoAvailability(serviceId: number | null) {
  const today = startOfDay(new Date());

  return Array.from({ length: 14 }, (_, index) => {
    const date = addDays(today, index);
    const key = format(date, "yyyy-MM-dd");
    const base = serviceId ? (serviceId % 4) + 2 : 3;
    const slots = index % 5 === 0 ? base + 3 : index % 3 === 0 ? 1 : base;
    return [key, slots] as const;
  }).reduce<Record<string, number>>((accumulator, [key, slots]) => {
    accumulator[key] = slots;
    return accumulator;
  }, {});
}

function ShimmerBlock({ className }: { className: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-white/6", className)}>
      <div className="absolute inset-0 animate-pulse bg-white/10" />
      <motion.div
        aria-hidden="true"
        animate={{ x: ["-130%", "130%"] }}
        transition={{ duration: 1.7, repeat: Infinity, ease: "linear" }}
        className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/18 to-transparent"
      />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <div className="rounded-[2.4rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <ShimmerBlock className="h-8 w-40" />
            <ShimmerBlock className="h-24 w-full" />
            <ShimmerBlock className="h-6 w-4/5" />
            <div className="flex flex-wrap gap-3">
              <ShimmerBlock className="h-12 w-40 rounded-full" />
              <ShimmerBlock className="h-12 w-36 rounded-full" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <ShimmerBlock key={index} className="h-28 rounded-[1.75rem]" />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <ShimmerBlock className="h-10 w-full rounded-[1.5rem]" />
            <ShimmerBlock className="h-[22rem] rounded-[2rem]" />
            <div className="grid gap-4 sm:grid-cols-2">
              <ShimmerBlock className="h-28 rounded-[1.5rem]" />
              <ShimmerBlock className="h-28 rounded-[1.5rem]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TestimonialsSkeleton() {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
      <ShimmerBlock className="h-8 w-64" />
      <ShimmerBlock className="mt-5 h-44 rounded-[1.75rem]" />
    </div>
  );
}

function DemoBadge({ demoMode }: { demoMode: boolean }) {
  if (!demoMode) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-amber-200">
      <Sparkles className="size-3.5" />
      Demo data fallback
    </span>
  );
}

function HomeBackground({
  mouse,
  reduceMotion,
}: {
  mouse: { x: number; y: number };
  reduceMotion: boolean;
}) {
  const translateX = reduceMotion ? 0 : (mouse.x - 50) / 2;
  const translateY = reduceMotion ? 0 : (mouse.y - 50) / 2;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <motion.div
        animate={
          reduceMotion
            ? undefined
            : { scale: [1, 1.06, 1], opacity: [0.35, 0.55, 0.35] }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 14, repeat: Infinity, ease: "easeInOut" }
        }
        style={{ translateX, translateY }}
        className="absolute -left-24 top-24 size-[34rem] rounded-full bg-sky-400/12 blur-[120px]"
      />
      <motion.div
        animate={
          reduceMotion
            ? undefined
            : { scale: [1, 1.08, 1], opacity: [0.18, 0.35, 0.18] }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 16, repeat: Infinity, ease: "easeInOut" }
        }
        style={{ translateX: -translateX, translateY: -translateY }}
        className="absolute -right-20 top-40 size-[28rem] rounded-full bg-emerald-400/10 blur-[110px]"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_35%),linear-gradient(180deg,rgba(2,6,23,0.38),rgba(2,6,23,0.12))]" />
    </div>
  );
}

export function HomePageClient() {
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;
  const { isAuthenticated, isOrganizer, isAdmin } = useAuth();

  const [services, setServices] = useState<Service[]>([]);
  const [availabilityByDay, setAvailabilityByDay] = useState<Record<string, number>>(
    {},
  );
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [mouse, setMouse] = useState({ x: 50, y: 35 });

  const currentService = useMemo(
    () =>
      services.find((service) => service.id === selectedServiceId) ??
      services[0] ??
      null,
    [selectedServiceId, services],
  );

  const availabilityDays = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: 14 }, (_, index) => {
      const date = addDays(today, index);
      const key = format(date, "yyyy-MM-dd");
      const slots = availabilityByDay[key] ?? 0;

      return {
        date,
        key,
        weekday: format(date, "EEE"),
        dayNumber: format(date, "d"),
        slots,
        isToday: isSameDay(date, today),
        isWeekend: [0, 6].includes(date.getDay()),
      } satisfies AvailabilityDay;
    });
  }, [availabilityByDay]);

  const openDays = useMemo(
    () => availabilityDays.filter((day) => day.slots > 0).length,
    [availabilityDays],
  );

  const totalSlots = useMemo(
    () => availabilityDays.reduce((sum, day) => sum + day.slots, 0),
    [availabilityDays],
  );

  const nextOpenDay = useMemo(
    () => availabilityDays.find((day) => day.slots > 0) ?? null,
    [availabilityDays],
  );

  const trustedTeams = useMemo(
    () => Math.max(18, services.length * 11 + openDays * 4 + totalSlots),
    [openDays, services.length, totalSlots],
  );

  const loadServices = useCallback(async () => {
    setPageError(null);

    try {
      const publishedServices = await apiFetch<Service[]>("/api/services");

      if (publishedServices.length === 0) {
        setServices(demoServices);
        setSelectedServiceId(demoServices[0]?.id ?? null);
        setDemoMode(true);
        return;
      }

      setServices(publishedServices);
      setSelectedServiceId((current) => current ?? publishedServices[0]?.id ?? null);
      setDemoMode(false);
    } catch {
      setServices(demoServices);
      setSelectedServiceId(demoServices[0]?.id ?? null);
      setDemoMode(true);
      setPageError("Live services could not be loaded, showing fallback content.");
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setIsLoading(true);
      await loadServices();
      if (active) {
        setIsLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadServices]);

  useEffect(() => {
    let active = true;

    async function loadAvailability() {
      if (!currentService) {
        setAvailabilityByDay({});
        return;
      }

      setIsCalendarLoading(true);

      try {
        const today = startOfDay(new Date());
        const responses = await Promise.all(
          Array.from({ length: 14 }, (_, index) => {
            const date = addDays(today, index);
            const key = format(date, "yyyy-MM-dd");

            return apiFetch<AvailableSlot[]>(
              `/api/services/${currentService.id}/availability`,
              { params: { date: key } },
            )
              .then((slots) => [key, slots] as const)
              .catch(() => [key, null] as const);
          }),
        );

        if (!active) {
          return;
        }

        const nextAvailability = responses.reduce<Record<string, number>>(
          (accumulator, [key, slots]) => {
            accumulator[key] = Array.isArray(slots)
              ? slots.reduce(
                  (sum, slot) => sum + Math.max(1, slot.available_capacity),
                  0,
                )
              : 0;
            return accumulator;
          },
          {},
        );

        const hasLiveData = Object.values(nextAvailability).some((value) => value > 0);
        setAvailabilityByDay(
          hasLiveData ? nextAvailability : createDemoAvailability(currentService.id),
        );
      } catch {
        if (active) {
          setAvailabilityByDay(createDemoAvailability(currentService.id));
        }
      } finally {
        if (active) {
          setIsCalendarLoading(false);
        }
      }
    }

    void loadAvailability();

    return () => {
      active = false;
    };
  }, [currentService]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadServices();
    setIsRefreshing(false);
  }, [loadServices]);

  const primaryCtaHref = currentService ? `/services/${currentService.id}` : "/auth/register";
  const workspaceHref = isOrganizer || isAdmin ? "/organizer" : "/dashboard";

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="relative min-h-screen overflow-hidden bg-[#020617] text-white"
        onMouseMove={(event) => {
          const x = (event.clientX / window.innerWidth) * 100;
          const y = (event.clientY / window.innerHeight) * 100;
          setMouse({ x, y });
        }}
      >
        <HomeBackground mouse={mouse} reduceMotion={reduceMotion} />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
          <div className="space-y-10">
            <motion.section
              initial={reduceMotion ? {} : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]"
            >
              <div className="rounded-[2.5rem] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82)),radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_35%)] p-7 shadow-[0_30px_120px_rgba(2,6,23,0.35)] sm:p-9">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/10 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-sky-100">
                    <Sparkles className="size-3.5" />
                    Live scheduling platform
                  </span>
                  <DemoBadge demoMode={demoMode} />
                </div>

                <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Booking pages that feel active, not empty.
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
                  Browse real services, check live availability, and move from interest to
                  confirmed appointments without the usual calendar friction.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href={primaryCtaHref}
                    className="inline-flex items-center gap-2 rounded-full bg-sky-400 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300"
                  >
                    {currentService ? "Book a featured service" : "Explore services"}
                    <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    href={workspaceHref}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    {isAuthenticated ? "Open workspace" : "See organizer flow"}
                    <Wand2 className="size-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleRefresh()}
                    disabled={isRefreshing}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw
                      className={cn("size-4", isRefreshing ? "animate-spin" : "")}
                    />
                    Refresh live data
                  </button>
                </div>

                {pageError ? (
                  <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                    {pageError}
                  </div>
                ) : null}

                <div className="mt-10 grid gap-4 sm:grid-cols-3">
                  <StatCard
                    icon={CalendarRange}
                    label="Published Services"
                    value={String(services.length)}
                    detail="Public services ready to book right now."
                    tone="sky"
                  />
                  <StatCard
                    icon={CalendarDays}
                    label="Open Days"
                    value={String(openDays)}
                    detail="Days with available appointment capacity in the next two weeks."
                    tone="emerald"
                  />
                  <StatCard
                    icon={Globe}
                    label="Trusted Teams"
                    value={trustedTeams.toLocaleString()}
                    detail="A dense scheduling surface designed for real team usage."
                    tone="amber"
                  />
                </div>
              </div>

              <div className="rounded-[2.5rem] border border-white/10 bg-slate-950/80 p-6 shadow-[0_30px_120px_rgba(2,6,23,0.28)] sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Live booking preview
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      {currentService?.name || "Select a service"}
                    </h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                    {isCalendarLoading ? "Syncing" : "Live"}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {services.slice(0, 5).map((service) => {
                    const active = currentService?.id === service.id;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setSelectedServiceId(service.id)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                          active
                            ? "border-sky-300/40 bg-sky-400/10 text-sky-100"
                            : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                        )}
                      >
                        {service.name}
                      </button>
                    );
                  })}
                </div>

                {currentService ? (
                  <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm leading-7 text-slate-300">
                          {currentService.description || "A live booking service with public availability."}
                        </p>
                      </div>
                      <Link
                        href={`/services/${currentService.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                      >
                        Open service
                        <ArrowRight className="size-4" />
                      </Link>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
                          Duration
                        </p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          {currentService.duration_minutes} min
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
                          Capacity
                        </p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          {currentService.capacity}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
                          Payment
                        </p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          {currentService.requires_advance_payment
                            ? `$${Number(currentService.advance_payment_amount ?? 0).toFixed(0)}`
                            : "None"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Next 14 days
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        Slot density for the selected service.
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        Total slots
                      </p>
                      <p className="mt-1 text-xl font-semibold text-white">
                        {totalSlots}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-7">
                    {availabilityDays.map((day) => {
                      const active = day.slots > 0;
                      return (
                        <div
                          key={day.key}
                          className={cn(
                            "rounded-2xl border p-3 transition-colors",
                            day.isToday
                              ? "border-sky-300/40 bg-sky-400/10"
                              : active
                                ? "border-emerald-400/15 bg-emerald-400/8"
                                : "border-white/8 bg-white/[0.03]",
                          )}
                        >
                          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
                            {day.weekday}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-white">
                            {day.dayNumber}
                          </p>
                          <p
                            className={cn(
                              "mt-2 text-xs",
                              day.slots > 0 ? "text-emerald-200" : "text-slate-500",
                            )}
                          >
                            {day.slots > 0 ? `${day.slots} open` : "Closed"}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                    <p className="text-sm text-slate-300">
                      {nextOpenDay
                        ? `Next availability: ${format(nextOpenDay.date, "EEE, MMM d")}`
                        : "No open days found right now."}
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {nextOpenDay ? `${nextOpenDay.slots} slots` : "0 slots"}
                    </p>
                  </div>
                </div>
              </div>
            </motion.section>

            <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[2.3rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Featured services
                    </p>
                    <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                      Bookable pages with real capacity and timing.
                    </h2>
                  </div>
                  <Link
                    href={currentService ? `/services/${currentService.id}` : "/"}
                    className="hidden rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:inline-flex"
                  >
                    Open featured service
                  </Link>
                </div>

                <div className="mt-6 grid gap-4">
                  {services.slice(0, 4).map((service) => (
                    <article
                      key={service.id}
                      className="rounded-[1.7rem] border border-white/10 bg-slate-950/65 p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="max-w-2xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-semibold text-white">
                              {service.name}
                            </h3>
                            {service.requires_advance_payment ? (
                              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-amber-200">
                                Paid
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-3 text-sm leading-7 text-slate-300">
                            {service.description || "A public booking service ready for customers."}
                          </p>
                        </div>

                        <Link
                          href={`/services/${service.id}`}
                          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
                        >
                          Book now
                          <ArrowRight className="size-4" />
                        </Link>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-4">
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Duration
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {service.duration_minutes} min
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Capacity
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {service.capacity}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Rules
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {service.max_bookings_per_user
                              ? `${service.max_bookings_per_user} per user`
                              : "Flexible"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Status
                          </p>
                          <p className="mt-1 text-sm font-semibold text-emerald-300">
                            {service.is_published ? "Published" : "Draft"}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <FeatureCard
                  icon={CalendarDays}
                  title="Customer-side booking"
                  description="Customers can browse published services, inspect live slots, answer booking questions, and confirm appointments without leaving the product."
                  badge="Phase 2"
                  href={primaryCtaHref}
                  ctaLabel="Try the booking flow"
                />
                <FeatureCard
                  icon={Wand2}
                  title="Organizer control"
                  description="Organizers can create services, assign resources, define form questions, publish links, and manage appointment operations from the app shell."
                  badge="Live"
                  href="/organizer/services"
                  ctaLabel="Manage services"
                />
                <FeatureCard
                  icon={ShieldCheck}
                  title="RBAC-ready surface"
                  description="Customers, organizers, and admins are separated by route and action. The frontend now points toward working flows instead of mock-only paths."
                  badge="RBAC"
                  href="/dashboard"
                  ctaLabel="Open dashboard"
                />
              </div>
            </section>

            <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <FeatureCard
                icon={BadgeCheck}
                title="Publishable services"
                description="Turn service definitions into public booking pages with shareable links and organizer-owned controls."
                badge="Core"
              />
              <FeatureCard
                icon={Clock3}
                title="Time-aware booking"
                description="Availability comes from service duration, resource assignment, and the backend slot engine."
                badge="Scheduling"
              />
              <FeatureCard
                icon={Video}
                title="Remote-ready"
                description="The product is shaped around scheduled sessions, consultations, onboarding calls, and recurring team reviews."
                badge="Meetings"
              />
              <FeatureCard
                icon={Globe}
                title="Public-facing"
                description="The homepage, service pages, and share links are positioned to support direct customer discovery."
                badge="Growth"
              />
            </section>

            <TestimonialsCarousel trustedTeams={trustedTeams} />

            <section className="rounded-[2.4rem] border border-white/10 bg-[linear-gradient(135deg,rgba(8,47,73,0.35),rgba(15,23,42,0.92)),radial-gradient(circle_at_top_right,rgba(59,130,246,0.22),transparent_35%)] p-7 sm:p-9">
              <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-sky-200/80">
                    Build momentum
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    The shell is ready for demos. The next gains are depth, not rescue.
                  </h2>
                  <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
                    Customers can now move from homepage to service booking to appointments.
                    Organizers can create and manage services. The remaining work is richer
                    admin and payment flows, not basic page survival.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={isOrganizer || isAdmin ? "/organizer/services/create" : "/auth/register"}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
                  >
                    {isOrganizer || isAdmin ? "Create a service" : "Create an account"}
                    <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    href="/appointments"
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    View appointments
                    <CalendarDays className="size-4" />
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
