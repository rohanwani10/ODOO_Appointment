"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { formatDate, formatDateTime, formatTime } from "@/lib/dates";
import type { Appointment } from "@/types/booking";
import type { Resource } from "@/types/resource";
import type { Service } from "@/types/service";
import type { AdminUsersResponse } from "@/types/user";

type SectionKey = "stats" | "timeline" | "actions" | "hero";

type SectionErrors = Partial<Record<SectionKey, string>>;

type AdminDashboardMetrics = {
  total_users: number;
  total_organizations: number;
  total_services: number;
  total_resources: number;
  total_providers: number;
  total_appointments: number;
  upcoming_appointments: number;
};

const statusClasses: Record<string, string> = {
  CONFIRMED: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  PENDING: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  RESCHEDULED: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  COMPLETED: "border-indigo-500/30 bg-indigo-500/15 text-indigo-300",
  CANCELLED: "border-rose-500/30 bg-rose-500/15 text-rose-300",
  NO_SHOW: "border-orange-500/30 bg-orange-500/15 text-orange-300",
};

const statContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const statItemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

function SkeletonCard() {
  return (
    <div className="glass animate-pulse rounded-[28px] p-6">
      <div className="mb-4 h-8 w-8 rounded-xl bg-white/10" />
      <div className="h-3 w-24 rounded bg-white/10" />
      <div className="mt-3 h-9 w-20 rounded bg-white/10" />
    </div>
  );
}

/**
 * Reusable stat card with loading and section-error states.
 */
function StatCard({
  label,
  value,
  icon: Icon,
  accentClass,
  loading,
  error,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
  loading?: boolean;
  error?: string;
}) {
  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <motion.div
      variants={statItemVariants}
      whileHover={{ scale: 1.015, y: -2 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
      className="glass group rounded-[28px] p-6 shadow-[0_8px_24px_rgba(2,6,23,0.18)]"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className={`flex size-10 items-center justify-center rounded-xl bg-white/10 ${accentClass}`}>
          <Icon className="size-5" />
        </div>
      </div>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      {error ? (
        <p className="mt-2 text-sm text-rose-300" aria-live="polite">
          Unavailable
        </p>
      ) : (
        <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      )}
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user, isAdmin, isOrganizer } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [organizerServices, setOrganizerServices] = useState<Service[]>([]);
  const [publicServices, setPublicServices] = useState<Service[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [serviceNamesById, setServiceNamesById] = useState<Record<number, string>>({});
  const [adminUserCount, setAdminUserCount] = useState<number | null>(null);
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboardMetrics | null>(null);

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<SectionErrors>({});
  const [nowMs, setNowMs] = useState(() => new Date().getTime());

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshNotice, setAutoRefreshNotice] = useState<string | null>(null);

  const isFresh = useMemo(() => {
    if (!lastUpdated) return false;
    return nowMs - lastUpdated.getTime() < 60 * 1000;
  }, [lastUpdated, nowMs]);

  const loadDashboard = useCallback(
    async (options?: { refresh?: boolean; source?: "manual" | "auto" | "initial" }) => {
      const refresh = options?.refresh ?? false;
      const source = options?.source ?? "manual";

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsInitialLoading(true);
      }

      setError(null);
      setSectionErrors({});

      const nextSectionErrors: SectionErrors = {};

      const [appointmentsResult, organizerServicesResult, publicServicesResult, resourcesResult, adminUsersResult, adminDashboardResult] =
        await Promise.allSettled([
          apiFetch<Appointment[]>("/api/appointments"),
          isOrganizer ? apiFetch<Service[]>("/api/organizer/services") : Promise.resolve([] as Service[]),
          apiFetch<Service[]>("/api/services"),
          isOrganizer ? apiFetch<Resource[]>("/api/resources") : Promise.resolve([] as Resource[]),
          isAdmin ? apiFetch<AdminUsersResponse>("/api/admin/users", { params: { skip: "0", limit: "1" } }) : Promise.resolve(null),
          isAdmin ? apiFetch<AdminDashboardMetrics>("/api/admin/dashboard") : Promise.resolve(null),
        ]);

      if (appointmentsResult.status === "fulfilled") {
        setAppointments(appointmentsResult.value);
      } else {
        nextSectionErrors.timeline = "Appointments feed is currently unavailable.";
      }

      if (organizerServicesResult.status === "fulfilled") {
        setOrganizerServices(organizerServicesResult.value);
      } else {
        nextSectionErrors.stats = "Organizer services could not be loaded.";
      }

      if (publicServicesResult.status === "fulfilled") {
        setPublicServices(publicServicesResult.value);
      } else {
        nextSectionErrors.stats = nextSectionErrors.stats ?? "Public service catalog unavailable.";
      }

      if (resourcesResult.status === "fulfilled") {
        setResources(resourcesResult.value);
      } else {
        nextSectionErrors.actions = "Resource workspace data unavailable.";
      }

      if (adminUsersResult.status === "fulfilled") {
        setAdminUserCount(adminUsersResult.value?.total ?? null);
      } else if (isAdmin) {
        nextSectionErrors.stats = nextSectionErrors.stats ?? "Admin user metrics unavailable.";
      }

      if (adminDashboardResult.status === "fulfilled") {
        setAdminDashboard(adminDashboardResult.value ?? null);
      } else if (isAdmin) {
        nextSectionErrors.hero = "Admin dashboard metrics unavailable.";
      }

      const mergedServices = [
        ...(organizerServicesResult.status === "fulfilled" ? organizerServicesResult.value : []),
        ...(publicServicesResult.status === "fulfilled" ? publicServicesResult.value : []),
      ];

      const map = mergedServices.reduce<Record<number, string>>((acc, service) => {
        acc[service.id] = service.name;
        return acc;
      }, {});
      setServiceNamesById(map);

      setSectionErrors(nextSectionErrors);

      const failedCount = Object.keys(nextSectionErrors).length;
      if (failedCount >= 3) {
        setError("Some dashboard sections could not be loaded. You can still use available sections below.");
      }

      setLastUpdated(new Date());
      if (source === "auto") {
        setAutoRefreshNotice("Dashboard updated automatically.");
        setTimeout(() => setAutoRefreshNotice(null), 2500);
      }

      setIsInitialLoading(false);
      setIsRefreshing(false);
    },
    [isAdmin, isOrganizer],
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadDashboard({ source: "initial" });
    }, 0);

    return () => window.clearTimeout(id);
  }, [loadDashboard]);

  useEffect(() => {
    const id = window.setInterval(() => {
      loadDashboard({ refresh: true, source: "auto" });
    }, 5 * 60 * 1000);

    return () => window.clearInterval(id);
  }, [loadDashboard]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(new Date().getTime()), 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  /**
   * Sorting and filtering appointment collections is the most reused computation.
   */
  const sortedAppointments = useMemo(() => {
    return [...appointments].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );
  }, [appointments]);

  /**
   * Upcoming events for next-event card and active booking count.
   */
  const upcomingAppointments = useMemo(() => {
    return sortedAppointments.filter(
      (a) => a.status !== "CANCELLED" && new Date(a.start_time).getTime() >= nowMs,
    );
  }, [sortedAppointments, nowMs]);

  const nextAppointment = upcomingAppointments[0] ?? null;

  const recentAppointments = useMemo(() => {
    return [...sortedAppointments].reverse().slice(0, 4);
  }, [sortedAppointments]);

  const last30Stats = useMemo(() => {
    const thirtyDaysAgo = nowMs - 30 * 24 * 60 * 60 * 1000;
    const windowed = appointments.filter(
      (a) => new Date(a.start_time).getTime() >= thirtyDaysAgo,
    );
    const confirmed = windowed.filter((a) => a.status === "CONFIRMED").length;
    const total = windowed.length;
    const percentage = total === 0 ? 0 : Math.round((confirmed / total) * 100);
    return { total, confirmed, percentage };
  }, [appointments, nowMs]);

  const monthlyProgress = useMemo(() => {
    if (isAdmin && adminDashboard) {
      const total = Math.max(adminDashboard.total_appointments, 1);
      const completed = adminDashboard.upcoming_appointments;
      const percent = Math.min(100, Math.round((completed / total) * 100));
      return {
        title: "Upcoming vs Total",
        completed,
        total,
        percent,
      };
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthAppointments = appointments.filter((a) => {
      const dt = new Date(a.start_time);
      return dt.getMonth() === currentMonth && dt.getFullYear() === currentYear;
    });

    const completed = monthAppointments.filter((a) => a.status === "COMPLETED").length;
    const total = Math.max(monthAppointments.length, 1);
    const percent = monthAppointments.length === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100));

    return {
      title: "Completed This Month",
      completed,
      total,
      percent,
    };
  }, [appointments, isAdmin, adminDashboard]);

  const statCards = useMemo(() => {
    const base = [
      {
        key: "active-bookings",
        label: "Active Bookings",
        value: String(upcomingAppointments.length),
        icon: Activity,
        accentClass: "text-primary",
      },
      {
        key: "completed",
        label: "Total Completed",
        value: String(appointments.filter((a) => a.status === "COMPLETED").length),
        icon: CheckCircle2,
        accentClass: "text-emerald-300",
      },
      {
        key: "services",
        label: "Services",
        value: String(isOrganizer ? organizerServices.length : publicServices.length),
        icon: Sparkles,
        accentClass: "text-indigo-300",
      },
      {
        key: "load-velocity",
        label: "Confirmed (30d)",
        value: `${last30Stats.percentage}%`,
        icon: TrendingUp,
        accentClass: "text-amber-300",
      },
    ];

    if (isAdmin) {
      base.push({
        key: "admin-users",
        label: "Admin Users",
        value: String(adminUserCount ?? 0),
        icon: Users,
        accentClass: "text-cyan-300",
      });
    }

    return base;
  }, [appointments, upcomingAppointments.length, isOrganizer, organizerServices.length, publicServices.length, last30Stats.percentage, isAdmin, adminUserCount]);

  return (
    <motion.div className="space-y-8 pb-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {error ? (
        <div
          className="glass rounded-2xl border border-rose-400/40 bg-rose-900/40 p-4"
          role="alert"
          aria-live="polite"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 text-rose-200" />
              <div>
                <p className="text-sm font-semibold text-rose-100">Dashboard load issue</p>
                <p className="text-sm text-rose-50/90">{error}</p>
              </div>
            </div>
            <button
              onClick={() => loadDashboard({ refresh: true, source: "manual" })}
              disabled={isRefreshing}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-200/60 px-4 py-2 text-sm font-semibold text-rose-50 transition hover:bg-rose-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="mr-2 size-4 animate-spin" /> Retrying...
                </>
              ) : (
                "Retry"
              )}
            </button>
          </div>
        </div>
      ) : null}

      <section
        role="region"
        aria-label="Dashboard overview"
        className="glass-premium relative overflow-hidden rounded-[36px] p-7 sm:p-10"
      >
        <div className="absolute -right-20 -top-20 size-80 rounded-full bg-primary/20 blur-[100px]" />
        <div className="absolute -left-20 -bottom-20 size-80 rounded-full bg-indigo-500/10 blur-[100px]" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_0.45fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="glass rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                Live Overview
              </span>
              <span className="text-xs font-medium text-slate-300">{user?.roles?.join(" / ")}</span>
              <span className="inline-flex items-center gap-2 text-xs text-slate-300">
                <span className={`size-2 rounded-full ${isFresh ? "bg-emerald-400" : "bg-amber-300"}`} />
                {isFresh ? "Fresh data" : "Refreshing soon"}
              </span>
            </div>

            <h1 className="text-gradient text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {isOrganizer ? "Ops Center" : "Welcome back"}, <span className="text-white">{user?.first_name}</span>
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-slate-200 sm:text-lg">
              {isOrganizer
                ? "Monitor bookings, resources, and performance from one premium command center."
                : "Stay on top of your upcoming sessions and important booking updates."}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/appointments"
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-slate-950 transition hover:scale-[1.01] hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
              >
                Manage Bookings
                <ArrowRight className="size-4" />
              </Link>

              <button
                onClick={() => loadDashboard({ refresh: true, source: "manual" })}
                disabled={isRefreshing}
                className="glass inline-flex min-h-11 items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Syncing..." : "Refresh Pulse"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span>
                Last updated: {lastUpdated ? formatDateTime(lastUpdated.toISOString()) : "Not yet"}
              </span>
              {autoRefreshNotice ? (
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-emerald-200" aria-live="polite">
                  {autoRefreshNotice}
                </span>
              ) : null}
            </div>

            {sectionErrors.hero ? (
              <p className="text-sm text-rose-300" aria-live="polite">{sectionErrors.hero}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="glass rounded-[28px] p-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Next Event</p>
                <CalendarClock className="size-5 text-primary" />
              </div>

              {sectionErrors.timeline ? (
                <p className="text-sm text-rose-300" aria-live="polite">Unable to load upcoming events.</p>
              ) : nextAppointment ? (
                <>
                  <p className="text-2xl font-bold text-white">{formatDate(nextAppointment.start_time)}</p>
                  <p className="mt-1 text-sm text-slate-300">
                    {serviceNamesById[nextAppointment.service_id] ?? "Service"} at {formatTime(nextAppointment.start_time)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-white">No events scheduled</p>
                  <p className="mt-1 text-sm text-slate-300">Your calendar is currently clear.</p>
                </>
              )}
            </div>

            <div className="glass rounded-[28px] p-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">System Trust</p>
                <BadgeCheck className={user?.is_verified ? "size-5 text-emerald-300" : "size-5 text-amber-300"} />
              </div>
              <p className="text-2xl font-bold text-white">{user?.is_verified ? "Verified" : "Verification Pending"}</p>
              <p className="mt-1 text-sm text-slate-300">{user?.email}</p>
            </div>
          </div>
        </div>
      </section>

      <section role="region" aria-label="Key statistics" className="space-y-3">
        {sectionErrors.stats ? (
          <div className="glass rounded-2xl border border-rose-400/35 bg-rose-900/35 p-4 text-sm text-rose-100" aria-live="polite">
            {sectionErrors.stats}
          </div>
        ) : null}

        <motion.div
          variants={statContainerVariants}
          initial="hidden"
          animate="visible"
          className={`grid gap-4 ${isAdmin ? "sm:grid-cols-2 xl:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-4"}`}
        >
          {statCards.map((card) => (
            <StatCard
              key={card.key}
              label={card.label}
              value={card.value}
              icon={card.icon}
              accentClass={card.accentClass}
              loading={isInitialLoading}
              error={sectionErrors.stats}
            />
          ))}
        </motion.div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.45fr]">
        <section role="region" aria-label="Activity stream" className="glass rounded-[32px] p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Activity Stream</h2>
            <Link
              href="/appointments"
              className="rounded-md text-xs font-bold uppercase tracking-[0.14em] text-primary transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
            >
              View All
            </Link>
          </div>

          {isInitialLoading ? (
            <div className="space-y-4">
              <div className="glass animate-pulse rounded-2xl p-6" />
              <div className="glass animate-pulse rounded-2xl p-6" />
              <div className="glass animate-pulse rounded-2xl p-6" />
            </div>
          ) : sectionErrors.timeline ? (
            <div className="rounded-2xl border border-rose-400/35 bg-rose-900/35 p-4 text-sm text-rose-100" aria-live="polite">
              {sectionErrors.timeline}
            </div>
          ) : recentAppointments.length === 0 ? (
            <div className="flex min-h-44 flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/5 px-5 text-center">
              <ClipboardList className="mb-3 size-9 text-slate-400" />
              <p className="text-base font-semibold text-white">No recent activity yet</p>
              <p className="mt-1 text-sm text-slate-300">Book a service to start seeing your activity timeline.</p>
              <Link
                href="/"
                className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
              >
                Browse Services
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentAppointments.map((appt, index) => (
                <motion.article
                  key={appt.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:shadow-[0_10px_30px_rgba(2,6,23,0.22)]"
                >
                  <div className="hidden size-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sm font-bold text-slate-200 sm:flex">
                    {formatTime(appt.start_time).split(":")[0]}
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-white">{serviceNamesById[appt.service_id] ?? "Service"}</h3>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.08em] ${statusClasses[appt.status] ?? "border-white/20 bg-white/10 text-white"}`}
                        aria-label={`Status: ${appt.status}`}
                      >
                        {appt.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">
                      {formatDate(appt.start_time)} at {formatTime(appt.start_time)}
                    </p>
                  </div>

                  <Link
                    href={`/appointments/${appt.id}`}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
                    aria-label={`Open appointment ${appt.id}`}
                    title="Open appointment details"
                  >
                    <ArrowRight className="size-4" />
                  </Link>
                </motion.article>
              ))}
            </div>
          )}
        </section>

        <section role="region" aria-label="Quick actions and workspace" className="space-y-5">
          <div className="glass rounded-[32px] p-6 sm:p-8">
            <h2 className="mb-5 text-xl font-bold text-white">Quick Actions</h2>
            {isOrganizer && !isInitialLoading ? (
              <p className="mb-4 text-xs text-slate-300">{resources.length} resources connected</p>
            ) : null}

            {isInitialLoading ? (
              <div className="space-y-3">
                <div className="glass animate-pulse rounded-2xl p-4" />
                <div className="glass animate-pulse rounded-2xl p-4" />
                <div className="glass animate-pulse rounded-2xl p-4" />
              </div>
            ) : sectionErrors.actions ? (
              <p className="rounded-2xl border border-rose-400/35 bg-rose-900/35 p-4 text-sm text-rose-100" aria-live="polite">
                {sectionErrors.actions}
              </p>
            ) : (
              <div className="grid gap-3">
                {[
                  {
                    label: isOrganizer ? "Service Manager" : "Browse Services",
                    href: isOrganizer ? "/organizer/services" : "/",
                    icon: Plus,
                    tooltip: isOrganizer
                      ? "Create, edit, and publish bookable services"
                      : "Find and book a new service",
                  },
                  {
                    label: "Appointments",
                    href: "/appointments",
                    icon: CalendarClock,
                    tooltip: "Review your upcoming and past appointments",
                  },
                  {
                    label: isOrganizer ? "Resource Setup" : "Profile",
                    href: isOrganizer ? "/organizer" : "/settings",
                    icon: isOrganizer ? Wrench : Shield,
                    tooltip: isOrganizer
                      ? "Manage organizations, resources, and working hours"
                      : "Update your account and preferences",
                  },
                ].map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    title={action.tooltip}
                    className="group flex min-h-11 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
                  >
                    <span className="flex items-center gap-3">
                      <span className="inline-flex size-9 items-center justify-center rounded-xl bg-white/10 text-slate-200">
                        <action.icon className="size-4" />
                      </span>
                      <span className="text-sm font-semibold text-white">{action.label}</span>
                    </span>
                    <ArrowRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="glass rounded-[32px] p-6 sm:p-8" role="region" aria-label="Monthly progress">
            <div className="mb-5 flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
                <Sparkles className="size-5" />
              </span>
              <h2 className="text-xl font-bold text-white">Monthly Target</h2>
            </div>

            {isInitialLoading ? (
              <div className="space-y-3">
                <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
                <div className="h-2 w-full animate-pulse rounded-full bg-white/10" />
              </div>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-300">{monthlyProgress.title}</span>
                  <span className="font-semibold text-white">
                    {monthlyProgress.completed}/{monthlyProgress.total}
                  </span>
                </div>

                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-label="Monthly target progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={monthlyProgress.percent}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${monthlyProgress.percent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-primary"
                  />
                </div>

                <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                  {monthlyProgress.total <= 1 && monthlyProgress.completed === 0
                    ? "No events scheduled"
                    : `${monthlyProgress.percent}% progress`}
                </p>
              </>
            )}
          </div>
        </section>
      </div>

      <section role="region" aria-label="Upcoming appointments">
        {isInitialLoading ? (
          <div className="glass animate-pulse rounded-[28px] p-8" />
        ) : sectionErrors.timeline ? (
          <div className="glass rounded-[28px] border border-rose-400/35 bg-rose-900/35 p-6 text-sm text-rose-100" aria-live="polite">
            Unable to load upcoming appointments.
          </div>
        ) : upcomingAppointments.length === 0 ? (
          <div className="glass rounded-[28px] p-8 text-center">
            <p className="text-lg font-semibold text-white">No upcoming events</p>
            <p className="mt-1 text-sm text-slate-300">Your schedule is free right now.</p>
            <Link
              href="/"
              className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
            >
              Browse Services
            </Link>
          </div>
        ) : null}
      </section>
    </motion.div>
  );
}
