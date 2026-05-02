"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MotionConfig,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CalendarRange,
  Clock3,
  ExternalLink,
  Globe,
  Loader2,
  MessageSquareMore,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Video,
  Wand2,
} from "lucide-react";
import {
  addDays,
  format,
  isSameDay,
  startOfDay,
} from "date-fns";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ElementType,
} from "react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { Service, AvailableSlot } from "@/types/service";
import { FeatureCard } from "./feature-card";
import { StatCard } from "./stat-card";

const TestimonialsCarousel = dynamic(
  () => import("./testimonials-carousel").then((module) => module.TestimonialsCarousel),
  {
    ssr: false,
    loading: () => <TestimonialsSkeleton />,
  },
);

type BookingReportItem = {
  service_id: number;
  service_name: string;
  count: number;
};

type GoogleProfile = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  google_calendar_id?: string | null;
  google_meet_enabled?: boolean | null;
  updated_at?: string | null;
  google_access_token?: string | null;
  google_refresh_token?: string | null;
};

type AvailabilityDay = {
  date: Date;
  key: string;
  weekday: string;
  dayNumber: string;
  slots: number;
  isToday: boolean;
  isWeekend: boolean;
};

type LoadPhase = "initial" | "refresh";

type DemoData = {
  services: Service[];
  bookings: BookingReportItem[];
  availability: Record<string, number>;
};

const demoServices: Service[] = [
  {
    id: 901,
    organization_id: 1,
    name: "Strategy Call",
    description: "A polished 30 minute call for discovery and next steps.",
    duration_minutes: 30,
    capacity: 1,
    is_published: true,
    shareable_link: "strategy-call",
    max_bookings_per_user: 2,
    requires_advance_payment: false,
    advance_payment_amount: null,
    created_by: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 902,
    organization_id: 1,
    name: "Team Review",
    description: "Weekly working session for recurring syncs.",
    duration_minutes: 45,
    capacity: 1,
    is_published: true,
    shareable_link: "team-review",
    max_bookings_per_user: 1,
    requires_advance_payment: false,
    advance_payment_amount: null,
    created_by: 1,
    created_at: new Date().toISOString(),
  },
];

const demoBookings: BookingReportItem[] = [
  { service_id: 901, service_name: "Strategy Call", count: 18 },
  { service_id: 902, service_name: "Team Review", count: 12 },
];

function createDemoAvailability(serviceId: number | null) {
  const today = startOfDay(new Date());
  return Array.from({ length: 14 }, (_, index) => {
    const date = addDays(today, index);
    const key = format(date, "yyyy-MM-dd");
    const base = serviceId ? (serviceId % 4) + 2 : 3;
    const slots = index % 4 === 0 ? base + 2 : index % 3 === 0 ? 1 : base;
    return [key, slots] as const;
  }).reduce<Record<string, number>>((accumulator, [key, slots]) => {
    accumulator[key] = slots;
    return accumulator;
  }, {});
}

function createDemoData(serviceId: number | null): DemoData {
  return {
    services: demoServices,
    bookings: demoBookings,
    availability: createDemoAvailability(serviceId),
  };
}

function formatRelativeTime(input?: string | null, now = Date.now()) {
  if (!input) {
    return "Just now";
  }

  const timestamp = new Date(input).getTime();
  if (!Number.isFinite(timestamp) || timestamp > now) {
    return "Just now";
  }

  const minutes = Math.max(0, Math.round((now - timestamp) / 60000));
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function toPrettyNumber(value: number) {
  return value.toLocaleString();
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
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
      <div className="glass-premium overflow-hidden rounded-[2.25rem] p-6 sm:p-8 lg:p-10">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
          <Loader2 className="size-4 animate-spin text-sky-300" />
          Loading your scheduling hub...
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <ShimmerBlock className="h-10 w-40" />
            <ShimmerBlock className="h-20 w-full" />
            <ShimmerBlock className="h-8 w-4/5" />
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
    <div className="glass-premium rounded-[2rem] p-6 sm:p-8">
      <ShimmerBlock className="h-8 w-64" />
      <ShimmerBlock className="mt-5 h-44 rounded-[1.75rem]" />
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
      <ShimmerBlock className="h-6 w-36" />
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
        {Array.from({ length: 14 }, (_, index) => (
          <ShimmerBlock key={index} className="aspect-square rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function DemoBadge({ demoMode }: { demoMode: boolean }) {
  if (!demoMode) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-amber-200">
      <Sparkles className="size-3.5" />
      Demo Mode
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_35%),linear-gradient(180deg,rgba(2,6,23,0.45),rgba(2,6,23,0.12))]" />
    </div>
  );
}

export function HomePageClient() {
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;
  const { user, isAuthenticated, isLoading: isAuthLoading, isOrganizer, isAdmin } = useAuth();

  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<BookingReportItem[]>([]);
  const [googleProfile, setGoogleProfile] = useState<GoogleProfile | null>(null);
  const [availabilityByDay, setAvailabilityByDay] = useState<Record<string, number>>({});
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [isGoogleConnecting, setIsGoogleConnecting] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
  const [mouse, setMouse] = useState({ x: 50, y: 35 });

  const currentService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? services[0] ?? null,
    [selectedServiceId, services],
  );

  const canViewReports = Boolean(isAuthenticated && (isOrganizer || isAdmin));
  const serviceCount = services.length;
  const totalBookings = useMemo(
    () => bookings.reduce((sum, booking) => sum + booking.count, 0),
    [bookings],
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

  const mobileAvailabilityDays = useMemo(() => availabilityDays.slice(0, 5), [availabilityDays]);
  const activeDay = useMemo(
    () => availabilityDays.find((day) => day.key === selectedDayKey) ?? availabilityDays[0] ?? null,
    [availabilityDays, selectedDayKey],
  );
  const openDays = useMemo(
    () => availabilityDays.filter((day) => day.slots > 0).length,
    [availabilityDays],
  );
  const totalSlots = useMemo(
    () => availabilityDays.reduce((sum, day) => sum + day.slots, 0),
    [availabilityDays],
  );
  const peakDay = useMemo(
    () => availabilityDays.reduce<AvailabilityDay | null>((best, day) => {
      if (!best || day.slots > best.slots) {
        return day;
      }
      return best;
    }, null),
    [availabilityDays],
  );
  const trustedTeams = useMemo(() => {
    if (demoMode) {
      return 240;
    }

    return Math.max(24, serviceCount * 9 + totalBookings * 2 + openDays * 3);
  }, [demoMode, openDays, serviceCount, totalBookings]);

  const lastSyncedLabel = useMemo(() => {
    if (!googleProfile?.updated_at) {
      return "Just now";
    }

    return formatRelativeTime(googleProfile.updated_at, currentTime);
  }, [currentTime, googleProfile?.updated_at]);

  const heroStats = useMemo(
    () => [
      {
        icon: CalendarRange,
        label: "Published services",
        value: toPrettyNumber(serviceCount || 0),
        detail: demoMode
          ? "Live public catalog with demo analytics layered in for clarity."
          : "Real published services from the backend service catalog.",
        tone: "sky" as const,
      },
      {
        icon: BadgeCheck,
        label: canViewReports ? "Bookings this month" : "Bookings preview",
        value: toPrettyNumber(canViewReports ? totalBookings : Math.max(totalBookings, 30)),
        detail: canViewReports
          ? "Pulled from /api/reports/bookings for the current organizer account."
          : "Demo-backed until an organizer account is connected.",
        tone: "emerald" as const,
      },
      {
        icon: CalendarDays,
        label: "Open days next 2 weeks",
        value: toPrettyNumber(openDays),
        detail: peakDay
          ? `Peak day: ${format(peakDay.date, "EEE, MMM d")} with ${peakDay.slots} slots.`
          : "Computed from live service availability windows.",
        tone: "violet" as const,
      },
    ],
    [canViewReports, demoMode, openDays, peakDay, serviceCount, totalBookings],
  );

  const featureCards = useMemo(
    () => [
      {
        icon: CalendarDays,
        title: "Smart availability",
        description:
          "Publish polished booking pages with slots that reflect your real service windows.",
        badge: demoMode ? "Demo" : "Live",
        href: "/pricing",
      },
      {
        icon: Clock3,
        title: "Timezone aware",
        description:
          "Every guest sees the right time instantly, removing confusion before they hit book.",
        badge: googleProfile?.google_calendar_id ? "Connected" : "Popular",
        href: "/auth/register",
      },
      {
        icon: Video,
        title: "Google Meet ready",
        description:
          "Calendar events and meeting links stay aligned the moment a booking is confirmed.",
        badge: googleProfile?.google_meet_enabled ? "New" : "Available",
        href: "/auth/login",
      },
      {
        icon: MessageSquareMore,
        title: "Instant confirmations",
        description:
          "Automated confirmations keep everyone aligned with clear booking details.",
        badge: totalBookings > 20 ? "Popular" : "New",
        href: "/pricing",
      },
      {
        icon: Wand2,
        title: "Automation first",
        description:
          "Buffers, reminders, and service rules stay in sync so availability stays accurate.",
        badge: serviceCount > 1 ? "New" : "Core",
        href: "/dashboard",
      },
      {
        icon: Globe,
        title: "Brandable workflows",
        description:
          "Tailor the booking experience with premium visual styling that feels native to your product.",
        badge: "Popular",
        href: "/pricing",
      },
    ],
    [demoMode, googleProfile?.google_calendar_id, googleProfile?.google_meet_enabled, serviceCount, totalBookings],
  );

  const quickLinks = useMemo(() => {
    if (!isAuthenticated) {
      return [];
    }

    return [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Settings", href: "/settings" },
    ];
  }, [isAuthenticated]);

  const loadAvailability = useCallback(
    async (serviceId: number, phase: LoadPhase = "initial") => {
      if (!serviceId) {
        return;
      }

      if (phase === "refresh") {
        setIsRefreshing(true);
      }

      setIsCalendarLoading(true);

      try {
        const today = startOfDay(new Date());
        const requests = Array.from({ length: 14 }, async (_, index) => {
          const date = addDays(today, index);
          const key = format(date, "yyyy-MM-dd");
          const slots = await apiFetch<AvailableSlot[]>(`/api/services/${serviceId}/availability`, {
            params: { date: key },
          });
          return [key, slots.length] as const;
        });

        const rows = await Promise.all(requests);
        setAvailabilityByDay(
          rows.reduce<Record<string, number>>((accumulator, [key, slots]) => {
            accumulator[key] = slots;
            return accumulator;
          }, {}),
        );
        setSelectedDayKey((current) => current ?? rows.find(([, slots]) => slots > 0)?.[0] ?? rows[0]?.[0] ?? null);
      } catch {
        setStatsError((current) => current ?? "Availability preview failed to load. Showing a demo fallback.");
        setDemoMode(true);
        setAvailabilityByDay(createDemoAvailability(serviceId));
      } finally {
        setIsCalendarLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  const loadDashboard = useCallback(
    async (phase: LoadPhase = "initial") => {
      if (phase === "refresh") {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setStatsError(null);

      try {
        const [servicesResponse, profileResponse, bookingsResponse] = await Promise.allSettled([
          apiFetch<Service[]>("/api/services"),
          isAuthenticated ? apiFetch<GoogleProfile>("/api/users/me") : Promise.resolve(null),
          canViewReports ? apiFetch<BookingReportItem[]>("/api/reports/bookings") : Promise.resolve([] as BookingReportItem[]),
        ]);

        if (servicesResponse.status === "fulfilled") {
          const nextServices = servicesResponse.value;
          setServices(nextServices);
          setSelectedServiceId((current) => current ?? nextServices[0]?.id ?? null);
          if (!nextServices.length) {
            setStatsError("No services available yet. Add your first service to unlock real availability insights.");
          }
        } else {
          const fallback = createDemoData(selectedServiceId);
          setServices(fallback.services);
          setSelectedServiceId(fallback.services[0]?.id ?? null);
          setBookings(fallback.bookings);
          setAvailabilityByDay(fallback.availability);
          setDemoMode(true);
          setStatsError("Unable to load live services. Using demo data for the landing page.");
        }

        if (profileResponse.status === "fulfilled") {
          setGoogleProfile(profileResponse.value);
        }

        if (bookingsResponse.status === "fulfilled") {
          setBookings(bookingsResponse.value);
          if (!canViewReports) {
            setDemoMode(true);
          }
        } else if (canViewReports) {
          const fallback = createDemoData(selectedServiceId);
          setBookings(fallback.bookings);
          setDemoMode(true);
          setStatsError((current) => current ?? "Booking stats failed to load. Showing a demo fallback until the API responds.");
        } else {
          setDemoMode(true);
        }
      } catch (error) {
        setDemoMode(true);
        const fallback = createDemoData(selectedServiceId);
        setServices((current) => current.length ? current : fallback.services);
        setBookings(fallback.bookings);
        setAvailabilityByDay((current) => Object.keys(current).length ? current : fallback.availability);
        setStatsError((current) => current ?? (error instanceof Error ? error.message : "Unable to load the scheduling hub."));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setCurrentTime(Date.now());
      }
    },
    [canViewReports, isAuthenticated, selectedServiceId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    if (!currentService) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadAvailability(currentService.id);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentService, loadAvailability]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  const handleRetry = () => {
    void loadDashboard("refresh");
    if (currentService) {
      void loadAvailability(currentService.id, "refresh");
    }
  };

  const handleConnectGoogle = useCallback(async () => {
    setIsGoogleConnecting(true);
    try {
      const response = await apiFetch<{ authorization_url: string }>("/api/auth/google/authorization-url");
      window.location.href = response.authorization_url;
    } catch (error) {
      setStatsError(
        error instanceof Error
          ? error.message
          : "Unable to start Google Calendar connection.",
      );
    } finally {
      setIsGoogleConnecting(false);
    }
  }, []);

  const handleSelectService = (serviceId: number) => {
    setSelectedServiceId(serviceId);
    const nextService = services.find((service) => service.id === serviceId);
    if (nextService) {
      void loadAvailability(nextService.id, "refresh");
    }
  };

  const handleDayClick = (day: AvailabilityDay) => {
    setSelectedDayKey(day.key);
    if (currentService) {
      router.push(`/services/${currentService.id}`);
    }
  };

  const connectionIsLive = Boolean(googleProfile?.google_calendar_id);
  const connectionStatusLabel = connectionIsLive ? "Connected" : "Disconnected";
  const hasServices = services.length > 0;
  const isBusy = isLoading || isAuthLoading;
  const refreshInProgress = isRefreshing || isCalendarLoading;

  const featureGrid = (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {featureCards.map((card, index) => (
        <motion.div
          key={card.title}
          variants={{
            hidden: { opacity: 0, y: 16 },
            show: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.35, delay: index * 0.05 }}
          whileHover={reduceMotion ? undefined : { y: -8, scale: 1.01 }}
          className="h-full"
        >
          <FeatureCard {...card} />
        </motion.div>
      ))}
    </div>
  );

  const emptyServicesState = (
    <div className="glass-premium rounded-[2rem] p-6 sm:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.26em] text-slate-400">
            No services available
          </p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Publish a service to unlock the live calendar preview.
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
            Once a service is created, this preview will populate with actual working hours, open days, and click-through booking links.
          </p>
        </div>
        <Link
          href="/pricing"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-slate-100"
        >
          Browse pricing
          <ArrowRight className="ml-2 size-4" />
        </Link>
      </div>
    </div>
  );

  if (isBusy) {
    return <LoadingState />;
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_32%),linear-gradient(180deg,#020617_0%,#0f172a_35%,#111827_100%)] text-white"
        onMouseMove={(event) => {
          if (reduceMotion) {
            return;
          }

          const bounds = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
          const x = ((event.clientX - bounds.left) / bounds.width) * 100;
          const y = ((event.clientY - bounds.top) / bounds.height) * 100;
          setMouse({ x, y });
        }}
      >
        <HomeBackground mouse={mouse} reduceMotion={reduceMotion} />

        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-2xl">
          <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-white text-sm font-bold text-slate-950 shadow-xl shadow-black/20">
                C
              </span>
              <div>
                <p className="text-lg font-semibold tracking-tight">Calvero</p>
                <p className="text-xs text-slate-400">Premium scheduling</p>
              </div>
            </Link>

            <nav className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <Link
                href="/pricing"
                className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-all hover:bg-white/10"
              >
                Pricing
              </Link>
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-all hover:bg-white/10"
                >
                  {link.label}
                </Link>
              ))}
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-11 items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-slate-100"
                >
                  Open dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-all hover:bg-white/10"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/auth/register"
                    className="inline-flex min-h-11 items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-slate-100"
                  >
                    Get started
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>

        <main className="relative z-10 pt-28 sm:pt-32">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1,
                },
              },
            }}
          >
            <section
              role="region"
              aria-label="Home hero"
              className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8"
            >
              {statsError ? (
                <div className="mb-6 rounded-[1.5rem] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-50 shadow-lg shadow-black/10">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-300" />
                      <p>{statsError}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:bg-slate-100"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="glass-premium overflow-hidden rounded-[2.5rem] p-6 shadow-[0_30px_120px_rgba(2,6,23,0.45)] sm:p-8 lg:p-10">
                <div className="grid gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:items-center">
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                        <Sparkles className="size-3.5 text-sky-300" />
                        Scheduling that feels effortless
                      </div>
                      <DemoBadge demoMode={demoMode} />
                    </div>

                    {isAuthenticated && user ? (
                      <div className="glass flex items-center justify-between gap-3 rounded-[1.5rem] px-4 py-3 text-sm text-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                            {user.first_name?.[0] ?? user.email[0]}
                            {user.last_name?.[0] ?? ""}
                          </div>
                          <div>
                            <p className="font-semibold text-white">
                              You’re logged in as {user.first_name} {user.last_name}
                            </p>
                            <p className="text-slate-400">Quick links and live stats are enabled.</p>
                          </div>
                        </div>
                        <div className="hidden gap-2 md:flex">
                          <Link
                            href="/dashboard"
                            className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-all hover:bg-white/10"
                          >
                            Dashboard
                          </Link>
                          <Link
                            href="/settings"
                            className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-all hover:bg-white/10"
                          >
                            Settings
                          </Link>
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <h1 className="max-w-4xl text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-7xl">
                        Turn every available slot into a premium booking experience.
                      </h1>
                      <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-slate-300 sm:text-xl">
                        Calvero syncs with Google Calendar, shows real availability,
                        and lets guests book instantly while automatically generating the meeting details.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={isAuthenticated ? "/dashboard" : "/auth/register"}
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-white px-6 py-3.5 text-base font-semibold text-slate-950 shadow-[0_16px_40px_rgba(255,255,255,0.18)] transition-all hover:-translate-y-0.5 hover:bg-slate-100 sm:w-auto"
                      >
                        {isAuthenticated ? "Open dashboard" : "Create account"}
                        <ArrowRight className="ml-2 size-4" />
                      </Link>
                      <Link
                        href="/pricing"
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-base font-semibold text-slate-100 transition-all hover:-translate-y-0.5 hover:bg-white/10 sm:w-auto"
                      >
                        Browse pricing
                      </Link>
                    </div>

                    {quickLinks.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {quickLinks.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-all hover:bg-white/10"
                          >
                            <ExternalLink className="size-3.5" />
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    <div className="glass-premium rounded-[2rem] p-5 sm:p-6">
                      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            Live scheduling snapshot
                          </p>
                          <p className="text-sm text-slate-400">
                            Pulled from backend reports and service availability.
                          </p>
                        </div>
                        <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", connectionIsLive ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-rose-400/20 bg-rose-400/10 text-rose-200")}>
                          <span className={cn("size-2 rounded-full", connectionIsLive ? "bg-emerald-300" : "bg-rose-300")} />
                          Google Calendar {connectionStatusLabel}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                            Active service
                          </p>
                          <p className="mt-2 text-lg font-semibold text-white">
                            {currentService?.name ?? "No service selected"}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {currentService?.duration_minutes
                              ? `${currentService.duration_minutes} minute booking window`
                              : "Add a service to unlock the live calendar"}
                          </p>
                        </div>
                        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                            Calendar sync
                          </p>
                          <p className="mt-2 text-lg font-semibold text-white">
                            {lastSyncedLabel}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            Last synced with Google Calendar profile data.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        {connectionIsLive ? (
                          <button
                            type="button"
                            onClick={() => {
                              void refreshUser();
                              handleRetry();
                            }}
                            disabled={refreshInProgress}
                            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition-all hover:bg-white/10"
                          >
                            {refreshInProgress ? (
                              <Loader2 className="mr-2 size-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 size-4" />
                            )}
                            {refreshInProgress ? "Refreshing" : "Refresh"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleConnectGoogle}
                            disabled={isGoogleConnecting}
                            className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isGoogleConnecting ? (
                              <Loader2 className="mr-2 size-4 animate-spin" />
                            ) : (
                              <Video className="mr-2 size-4" />
                            )}
                            Connect Google Calendar
                          </button>
                        )}
                        <Link
                          href="/auth/login"
                          className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition-all hover:bg-white/10"
                        >
                          {isAuthenticated ? "Switch account" : "Sign in"}
                        </Link>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      {heroStats.map((stat) => (
                        <StatCard
                          key={stat.label}
                          icon={stat.icon as ElementType}
                          label={stat.label}
                          value={stat.value}
                          detail={stat.detail}
                          tone={stat.tone}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section
              role="region"
              aria-label="Features"
              className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
            >
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Features
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Everything you need to turn availability into revenue.
                </h2>
                <p className="mt-4 max-w-xl text-lg leading-8 text-slate-300">
                  The product surface stays intentionally minimal, but the scheduling logic underneath is real.
                </p>
              </div>

              <motion.div className="mt-10">{featureGrid}</motion.div>
            </section>

            <section
              role="region"
              aria-label="Calendar preview"
              className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
            >
              <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr] lg:items-start">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Calendar preview
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Tap a real day to open the matching booking page.
                  </h2>
                  <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                    This calendar is powered by actual service availability. Hover to see slot counts, then click a day to jump into the service flow.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {services.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => handleSelectService(service.id)}
                        className={cn(
                          "inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-medium transition-all",
                          service.id === currentService?.id
                            ? "border-white/20 bg-white text-slate-950"
                            : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                        )}
                      >
                        {service.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {hasServices ? (
                    <div className="glass-premium rounded-[2rem] p-5 sm:p-6">
                      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            Availability for {currentService?.name ?? "selected service"}
                          </p>
                          <p className="text-sm text-slate-400">
                            {openDays} open days · {totalSlots} total slots
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => currentService && void loadAvailability(currentService.id, "refresh")}
                          disabled={refreshInProgress}
                          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition-all hover:bg-white/10"
                        >
                          {refreshInProgress ? (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 size-4" />
                          )}
                          {refreshInProgress ? "Refreshing" : "Refresh"}
                        </button>
                      </div>

                      {isCalendarLoading ? (
                        <div className="mt-5">
                          <CalendarSkeleton />
                        </div>
                      ) : (
                        <>
                          <div className="mt-5 hidden grid-cols-7 gap-2 md:grid">
                            {[
                              { label: "S", key: "sun" },
                              { label: "M", key: "mon" },
                              { label: "T", key: "tue" },
                              { label: "W", key: "wed" },
                              { label: "T", key: "thu" },
                              { label: "F", key: "fri" },
                              { label: "S", key: "sat" },
                            ].map((day) => (
                              <div
                                key={day.key}
                                className="pb-1 text-center text-[0.65rem] uppercase tracking-[0.26em] text-slate-500"
                              >
                                {day.label}
                              </div>
                            ))}
                            {availabilityDays.map((day) => (
                              <button
                                key={day.key}
                                type="button"
                                role="button"
                                aria-label={`${format(day.date, "EEEE, MMMM d")}. ${day.slots} slots available.`}
                                title={`${day.slots} slot${day.slots === 1 ? "" : "s"} available`}
                                onClick={() => handleDayClick(day)}
                                className={cn(
                                  "group relative aspect-square rounded-2xl border p-3 text-left transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                                  day.slots > 0
                                    ? day.slots <= 2
                                      ? "border-amber-300/20 bg-amber-300/10 text-amber-50"
                                      : "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
                                    : "border-white/10 bg-white/[0.04] text-slate-500",
                                  day.isToday && "ring-2 ring-white/45",
                                )}
                              >
                                <div className="flex h-full flex-col justify-between">
                                  <div>
                                    <p className="text-[0.66rem] uppercase tracking-[0.24em] opacity-70">
                                      {day.weekday}
                                    </p>
                                    <p className="mt-1 text-xl font-semibold">{day.dayNumber}</p>
                                  </div>
                                  <div className="flex items-end justify-between gap-2">
                                    <span className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] opacity-80">
                                      {day.slots > 0 ? `${day.slots} slots` : "Closed"}
                                    </span>
                                    {day.slots > 0 ? (
                                      <span className="size-2 rounded-full bg-current opacity-80" />
                                    ) : null}
                                  </div>
                                  <span className="absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-slate-950/95 px-2.5 py-1 text-[0.65rem] text-white shadow-xl group-hover:block">
                                    {day.slots} slot{day.slots === 1 ? "" : "s"} available
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>

                          <div className="mt-5 grid grid-cols-5 gap-2 md:hidden">
                            {mobileAvailabilityDays.map((day) => (
                              <button
                                key={day.key}
                                type="button"
                                role="button"
                                aria-label={`${format(day.date, "EEEE, MMMM d")}. ${day.slots} slots available.`}
                                title={`${day.slots} slot${day.slots === 1 ? "" : "s"} available`}
                                onClick={() => handleDayClick(day)}
                                className={cn(
                                  "relative aspect-square rounded-2xl border p-2 text-left text-xs transition-all hover:-translate-y-1",
                                  day.slots > 0
                                    ? day.slots <= 2
                                      ? "border-amber-300/20 bg-amber-300/10 text-amber-50"
                                      : "border-emerald-300/20 bg-emerald-300/10 text-emerald-50"
                                    : "border-white/10 bg-white/[0.04] text-slate-500",
                                )}
                              >
                                <div className="flex h-full flex-col justify-between">
                                  <div>
                                    <p className="text-[0.58rem] uppercase tracking-[0.2em] opacity-70">
                                      {day.weekday}
                                    </p>
                                    <p className="mt-1 text-lg font-semibold">{day.dayNumber}</p>
                                  </div>
                                  <span className="text-[0.58rem] font-semibold uppercase tracking-[0.2em] opacity-80">
                                    {day.slots > 0 ? `${day.slots} slots` : "Closed"}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    emptyServicesState
                  )}

                  {activeDay ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="glass-premium rounded-[1.75rem] p-5">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                          Selected day
                        </p>
                        <p className="mt-3 text-2xl font-semibold text-white">
                          {format(activeDay.date, "EEE, MMM d")}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          {activeDay.slots > 0
                            ? `${activeDay.slots} slot${activeDay.slots === 1 ? "" : "s"} available for booking.`
                            : "No slots are currently open for this day."}
                        </p>
                      </div>
                      <div className="glass-premium rounded-[1.75rem] p-5">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                          Booking depth
                        </p>
                        <p className="mt-3 text-2xl font-semibold text-white">
                          {peakDay ? `${peakDay.slots} max slots` : "Live"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          Hover a date to preview availability, then click to open the service flow.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section
              role="region"
              aria-label="Google Calendar status"
              className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
            >
              <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Google Calendar integration
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    See your real sync status at a glance.
                  </h2>
                  <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                    The home page reads your account state from the backend, then exposes the same integration path used by the booking flow.
                  </p>
                </div>

                <div className="glass-premium rounded-[2rem] p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Google Calendar
                      </p>
                      <p className="text-sm text-slate-400">
                        {connectionIsLive
                          ? "Connected through your user profile"
                          : "Not connected yet"}
                      </p>
                    </div>
                    <div className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]", connectionIsLive ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-rose-400/20 bg-rose-400/10 text-rose-200")}>
                      <span className={cn("size-2 rounded-full", connectionIsLive ? "bg-emerald-300" : "bg-rose-300")} />
                      {connectionStatusLabel}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                        Last synced
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {connectionIsLive ? lastSyncedLabel : "Connect to sync"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {connectionIsLive
                          ? "Profile timestamp used as the best available sync signal."
                          : "Connect Google Calendar to enable live sync status."}
                      </p>
                    </div>
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                        Meet support
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {googleProfile?.google_meet_enabled ? "Enabled" : "Available"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {googleProfile?.google_meet_enabled
                          ? "Meet links are attached to newly confirmed events."
                          : "Meet generation is ready once the account is connected."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    {connectionIsLive ? (
                      <button
                        type="button"
                        onClick={() => {
                          void refreshUser();
                          handleRetry();
                        }}
                        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-slate-100"
                      >
                        <RefreshCw className="mr-2 size-4" />
                        Refresh status
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectGoogle}
                        disabled={isGoogleConnecting}
                        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isGoogleConnecting ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Video className="mr-2 size-4" />
                        )}
                        Connect Google Calendar
                      </button>
                    )}
                    <Link
                      href="/settings"
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition-all hover:bg-white/10"
                    >
                      Calendar settings
                    </Link>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                      OAuth 2.0
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                      Event sync
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                      Meet links
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section
              role="region"
              aria-label="Trust signals"
              className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
            >
              <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Trust signals
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Trusted by teams that need scheduling to feel invisible.
                  </h2>
                  <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                    Security, reliability, and product clarity are all part of the conversion path.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {[
                      "SOC 2 ready",
                      "GDPR aligned",
                      "OAuth secured",
                      "44px touch targets",
                    ].map((badge) => (
                      <span
                        key={badge}
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
                      >
                        <ShieldCheck className="mr-2 size-4 text-emerald-300" />
                        {badge}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {[
                      "/vercel.svg",
                      "/next.svg",
                      "/globe.svg",
                    ].map((logo, index) => (
                      <div
                        key={logo}
                        className="glass flex min-h-24 items-center justify-center rounded-[1.5rem] p-4"
                      >
                        <Image
                          src={logo}
                          alt={`Partner logo placeholder ${index + 1}`}
                          width={96}
                          height={48}
                          className="h-9 w-auto opacity-85"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <TestimonialsCarousel trustedTeams={trustedTeams} />
              </div>
            </section>

            <section
              role="region"
              aria-label="Call to action"
              className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
            >
              <div className="rounded-[2.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] px-6 py-12 text-center shadow-[0_30px_120px_rgba(2,6,23,0.45)] sm:px-10">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-300">
                  Ready to launch
                </p>
                <h2 className="mx-auto mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                  Start with Calvero and turn every available slot into a clean booking experience.
                </h2>
                <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                  Give visitors a polished path from interest to confirmed meeting with no manual follow-up.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link
                    href={isAuthenticated ? "/dashboard" : "/auth/register"}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-6 py-3.5 text-base font-semibold text-slate-950 transition-all hover:-translate-y-0.5 hover:bg-slate-100"
                  >
                    {isAuthenticated ? "Open dashboard" : "Get started"}
                  </Link>
                  <Link
                    href="/pricing"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-base font-semibold text-slate-100 transition-all hover:bg-white/10"
                  >
                    Browse pricing
                  </Link>
                </div>
              </div>
            </section>
          </motion.div>
        </main>
      </div>
    </MotionConfig>
  );
}
