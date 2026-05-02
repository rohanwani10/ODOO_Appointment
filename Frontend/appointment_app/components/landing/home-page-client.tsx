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

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // load demo data quickly
        const demo = createDemoData(null);
        if (!mounted) return;
        setServices(demo.services);
        setBookings(demo.bookings);
        setAvailabilityByDay(demo.availability);
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setStatsError("Failed to load data");
      } finally {
        if (!mounted) return;
        setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Minimal placeholder UI to keep the app running after neutralization edits
  return (
    <div className="mx-auto max-w-7xl p-6 text-white">
      <h1 className="text-3xl font-bold">Calvero</h1>
      <p className="mt-2 text-sm text-slate-400">Landing content temporarily minimized.</p>
    </div>
  );
}
