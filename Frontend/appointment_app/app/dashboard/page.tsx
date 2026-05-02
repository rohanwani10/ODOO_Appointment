"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  ClipboardList,
  Shield,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/auth/auth-guard";
import { apiFetch } from "@/lib/api";
import { formatDate, formatDateTime, formatTime } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import type { Appointment } from "@/types/booking";
import type { Resource } from "@/types/resource";
import type { Service } from "@/types/service";
import type { AdminUsersResponse } from "@/types/user";

const statusClasses: Record<string, string> = {
  CONFIRMED: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
  PENDING: "border-amber-300/20 bg-amber-400/10 text-amber-100",
  RESCHEDULED: "border-sky-300/20 bg-sky-400/10 text-sky-100",
  COMPLETED: "border-violet-300/20 bg-violet-400/10 text-violet-100",
  CANCELLED: "border-rose-300/20 bg-rose-400/10 text-rose-100",
  NO_SHOW: "border-slate-300/20 bg-slate-400/10 text-slate-100",
};

export default function DashboardPage() {
  const { user, isAdmin, isOrganizer, logout } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [serviceNamesById, setServiceNamesById] = useState<Record<number, string>>(
    {},
  );
  const [organizerServices, setOrganizerServices] = useState<Service[]>([]);
  const [publicServices, setPublicServices] = useState<Service[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [adminUserCount, setAdminUserCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleLogout = async () => {
    await logout();
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
    } catch (sendError) {
      setStatus(getErrorMessage(sendError, "Unable to send OTP."));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const loadDashboard = async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    try {
      const [
        appointmentData,
        organizerServiceData,
        publicServiceData,
        resourceData,
        adminUsersData,
      ] = await Promise.all([
        apiFetch<Appointment[]>("/api/appointments"),
        isOrganizer
          ? apiFetch<Service[]>("/api/organizer/services")
          : Promise.resolve([]),
        apiFetch<Service[]>("/api/services"),
        isOrganizer ? apiFetch<Resource[]>("/api/resources") : Promise.resolve([]),
        isAdmin
          ? apiFetch<AdminUsersResponse>("/api/admin/users", {
              params: { skip: "0", limit: "1" },
            })
          : Promise.resolve(null),
      ]);

      const serviceMap = organizerServiceData.reduce<Record<number, string>>(
        (accumulator, service) => {
          accumulator[service.id] = service.name;
          return accumulator;
        },
        {},
      );

      publicServiceData.forEach((service) => {
        serviceMap[service.id] = service.name;
      });

      const missingServiceIds = Array.from(
        new Set(
          appointmentData
            .map((appointment) => appointment.service_id)
            .filter((serviceId) => !serviceMap[serviceId]),
        ),
      );

      if (missingServiceIds.length > 0) {
        const extraServices = await Promise.all(
          missingServiceIds.map(async (serviceId) => {
            try {
              return await apiFetch<Service>(`/api/services/${serviceId}`);
            } catch {
              return null;
            }
          }),
        );

        extraServices.forEach((service) => {
          if (service) {
            serviceMap[service.id] = service.name;
          }
        });
      }

      setAppointments(appointmentData);
      setOrganizerServices(organizerServiceData);
      setPublicServices(publicServiceData);
      setResources(resourceData);
      setAdminUserCount(adminUsersData?.total ?? null);
      setServiceNamesById(serviceMap);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load dashboard data."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    async function run() {
      if (isCancelled) {
        return;
      }
      await loadDashboard();
    }

    void run();

    return () => {
      isCancelled = true;
    };
  }, [isAdmin, isOrganizer]);

  const now = Date.now();
  const sortedAppointments = [...appointments].sort(
    (left, right) =>
      new Date(left.start_time).getTime() - new Date(right.start_time).getTime(),
  );
  const upcomingAppointments = sortedAppointments.filter(
    (appointment) =>
      appointment.status !== "CANCELLED" &&
      new Date(appointment.start_time).getTime() >= now,
  );
  const recentAppointments = [...sortedAppointments]
    .reverse()
    .slice(0, 4);
  const nextAppointment = upcomingAppointments[0] ?? null;
  const publishedOrganizerServices = organizerServices.filter(
    (service) => service.is_published,
  );
  const draftOrganizerServices = organizerServices.filter(
    (service) => !service.is_published,
  );
  const completedAppointments = appointments.filter(
    (appointment) => appointment.status === "COMPLETED",
  ).length;
  const cancelledAppointments = appointments.filter(
    (appointment) => appointment.status === "CANCELLED",
  ).length;
  const unverified = !user?.is_verified;

  const roleHeadline = isOrganizer
    ? "Operations cockpit for bookings, services, and resource capacity."
    : "Your clean booking hub for upcoming sessions and fast actions.";

  const primaryStatLabel = isOrganizer ? "Published services" : "Next appointment";
  const primaryStatValue = isOrganizer
    ? String(publishedOrganizerServices.length)
    : nextAppointment
      ? formatDate(nextAppointment.start_time)
      : "None yet";
  const secondaryStatLabel = isOrganizer ? "Active resources" : "Appointments";
  const secondaryStatValue = isOrganizer
    ? String(resources.length)
    : String(appointments.length);

  const quickLinks = [
    { href: "/appointments", label: "View appointments", show: true },
    { href: "/settings", label: "Update profile", show: true },
    { href: "/organizer", label: "Open organizer workspace", show: isOrganizer },
    { href: "/admin", label: "Open admin dashboard", show: isAdmin },
    { href: "/", label: "Browse services", show: true },
  ].filter((item) => item.show);

  return (
    <AuthGuard>
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(12,18,38,0.95),rgba(17,24,39,0.88)),radial-gradient(circle_at_top_right,rgba(56,189,248,0.28),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.16),transparent_24%)] p-8 shadow-2xl shadow-slate-950/30">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-20 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl" />

          <div className="relative grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">
                  Dashboard
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {user?.roles?.join(" · ") || "CUSTOMER"}
                </span>
                {unverified && (
                  <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-amber-100">
                    Verification pending
                  </span>
                )}
              </div>

              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                {isOrganizer
                  ? `Run the calendar, ${user?.first_name}.`
                  : `Good to see you, ${user?.first_name}.`}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                {roleHeadline}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {quickLinks.slice(0, 3).map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
                  >
                    {link.label}
                  </Link>
                ))}
                <button
                  onClick={() => void loadDashboard(true)}
                  className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  {isRefreshing ? "Refreshing..." : "Refresh data"}
                </button>
                <button
                  onClick={() => void handleLogout()}
                  className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Logout
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-3xl border border-white/10 bg-white/6 p-5 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {primaryStatLabel}
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-white">
                      {primaryStatValue}
                    </p>
                  </div>
                  <CalendarClock className="h-10 w-10 text-sky-300/80" />
                </div>
                {nextAppointment && !isOrganizer && (
                  <p className="mt-4 text-sm text-slate-300">
                    {serviceNamesById[nextAppointment.service_id] ||
                      `Service #${nextAppointment.service_id}`}{" "}
                    at {formatTime(nextAppointment.start_time)}
                  </p>
                )}
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {secondaryStatLabel}
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-white">
                      {secondaryStatValue}
                    </p>
                  </div>
                  {isOrganizer ? (
                    <Building2 className="h-10 w-10 text-amber-200/80" />
                  ) : (
                    <ClipboardList className="h-10 w-10 text-emerald-200/80" />
                  )}
                </div>
                <p className="mt-4 text-sm text-slate-300">
                  {isOrganizer
                    ? `${draftOrganizerServices.length} drafts waiting on publish.`
                    : `${completedAppointments} completed and ${cancelledAppointments} cancelled.`}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 sm:col-span-2 xl:col-span-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Account integrity
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-white">
                      {user?.is_verified ? "Verified" : "Needs action"}
                    </p>
                  </div>
                  {user?.is_verified ? (
                    <BadgeCheck className="h-10 w-10 text-emerald-300/80" />
                  ) : (
                    <Shield className="h-10 w-10 text-amber-200/80" />
                  )}
                </div>
                <p className="mt-4 text-sm text-slate-300">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        </section>

        {status && (
          <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            {status}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {unverified && (
          <section className="grid gap-4 rounded-[28px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(120,53,15,0.35),rgba(251,191,36,0.12))] p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-amber-100/80">
                Verification block
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-amber-50">
                Your account is usable, but not trusted yet.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-amber-100/90">
                Send a fresh OTP to lock in the account before you book more
                appointments or start sharing organizer services.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={sendOtp}
                disabled={isSendingOtp}
                className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSendingOtp ? "Sending OTP..." : "Send OTP"}
              </button>
              <Link
                href="/auth/verify-otp"
                className="rounded-full border border-amber-100/20 px-4 py-2 text-sm font-semibold text-amber-50 transition-colors hover:bg-white/10"
              >
                Verify now
              </Link>
            </div>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Upcoming
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {upcomingAppointments.length}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Active future bookings
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Completed
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {completedAppointments}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Finished appointments
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Services in play
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {isOrganizer ? organizerServices.length : publicServices.length}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {isOrganizer ? "Owned services" : "Published options to book"}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {isAdmin ? "Users in system" : "Profile state"}
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">
              {isAdmin ? adminUserCount ?? "..." : user?.is_active ? "Active" : "Paused"}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {isAdmin ? "Admin-level visibility" : "Account availability"}
            </p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {isOrganizer ? "Booking stream" : "Your timeline"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Recent appointment movement
                </h2>
              </div>
              <CalendarClock className="h-8 w-8 text-sky-300/70" />
            </div>

            <div className="mt-6 space-y-4">
              {isLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                  Loading appointment activity...
                </div>
              ) : recentAppointments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                  No appointment activity yet. Use the service catalog to create
                  the first booking.
                </div>
              ) : (
                recentAppointments.map((appointment) => (
                  <article
                    key={appointment.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:bg-white/[0.07]"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-white">
                            {serviceNamesById[appointment.service_id] ||
                              `Service #${appointment.service_id}`}
                          </p>
                          <span
                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                              statusClasses[appointment.status] ||
                              "border-white/10 bg-white/5 text-slate-100"
                            }`}
                          >
                            {appointment.status}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-slate-300">
                          {formatDate(appointment.start_time)} at{" "}
                          {formatTime(appointment.start_time)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Created {formatDateTime(appointment.created_at)}
                        </p>
                        {appointment.notes && (
                          <p className="mt-3 text-sm leading-7 text-slate-300">
                            {appointment.notes}
                          </p>
                        )}
                      </div>

                      <Link
                        href={`/appointments/${appointment.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                      >
                        Open
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Quick launch
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Fast moves
                  </h2>
                </div>
                <Sparkles className="h-8 w-8 text-amber-200/80" />
              </div>

              <div className="mt-5 grid gap-3">
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                ))}
              </div>
            </section>

            {isOrganizer ? (
              <section className="rounded-[28px] border border-white/10 bg-slate-950/70 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Service health
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      What needs attention
                    </h2>
                  </div>
                  <Wrench className="h-8 w-8 text-sky-300/70" />
                </div>

                <div className="mt-5 grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Draft services
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {draftOrganizerServices.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Published services
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {publishedOrganizerServices.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Resource capacity
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {resources.length}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {organizerServices.slice(0, 3).map((service) => (
                    <article
                      key={service.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{service.name}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {service.duration_minutes} min · capacity {service.capacity}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                            service.is_published
                              ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                              : "border-amber-300/20 bg-amber-400/10 text-amber-100"
                          }`}
                        >
                          {service.is_published ? "Live" : "Draft"}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <section className="rounded-[28px] border border-white/10 bg-slate-950/70 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Book next
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Good options right now
                    </h2>
                  </div>
                  <Users className="h-8 w-8 text-emerald-200/80" />
                </div>

                <div className="mt-5 space-y-3">
                  {publicServices.slice(0, 3).map((service) => (
                    <article
                      key={service.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{service.name}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {service.duration_minutes} min · capacity {service.capacity}
                          </p>
                        </div>
                        <Link
                          href={`/services/${service.id}`}
                          className="rounded-full bg-sky-400 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950 transition-colors hover:bg-sky-300"
                        >
                          Book
                        </Link>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-300">
                        {service.description || "No description yet."}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        </section>
      </div>
    </AuthGuard>
  );
}
