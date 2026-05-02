"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  AlertCircle,
  ArrowRight,
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  History,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  X,
  XCircle,
  LayoutGrid,
  List,
  CircleDashed,
  Undo2,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  formatDistanceToNow,
  isAfter,
  isBefore,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { formatDate, formatDateTime, formatTime } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { Appointment } from "@/types/booking";
import type { Resource } from "@/types/resource";
import type { Service } from "@/types/service";

interface AppointmentConfirmation {
  appointment_id: number;
  status: string;
  service_name?: string | null;
  resource_name?: string | null;
  start_time: string;
  end_time: string;
  capacity_used: number;
  notes?: string | null;
  created_at: string;
}

type AppointmentViewMode = "list" | "calendar";
type SortOption = "newest" | "oldest" | "status" | "service";
type StatusFilter = "all" | "confirmed" | "pending" | "cancelled" | "rescheduled" | "completed" | "no_show";
type DateRangeFilter = "all" | "today" | "week" | "month" | "custom";
type QuickChip = "all" | "upcoming" | "past" | "cancelled" | "today";

type FilterState = {
  status: StatusFilter;
  range: DateRangeFilter;
  from: string;
  to: string;
  chip: QuickChip;
  sort: SortOption;
  view: AppointmentViewMode;
};

type FilterPatch = Partial<FilterState>;

type GroupedAppointments = {
  key: string;
  label: string;
  date: Date;
  items: Appointment[];
};

type ToastState = {
  id: number;
  message: string;
  tone?: "success" | "error";
};

type CardActionError = Record<number, string>;

type AppointmentCardProps = {
  appointment: Appointment;
  servicesById: Record<number, Service>;
  resourcesById: Record<number, Resource>;
  confirmationById: Record<number, AppointmentConfirmation>;
  onCancel: (appointment: Appointment) => void;
  onOpen: (appointmentId: number) => void;
  onFocusMove: (currentIndex: number, direction: 1 | -1) => void;
  index: number;
  isOrganizer: boolean;
  isSelected: boolean;
  isReducedMotion: boolean;
  isAdmin: boolean;
  actionError?: string;
  onToggleSelected: (appointmentId: number) => void;
  registerRef: (node: HTMLElement | null) => void;
};

type FilterBarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filters: FilterState;
  onFilterChange: (patch: FilterPatch) => void;
  activeFilterCount: number;
  onClearFilters: () => void;
  totalAppointments: number;
  filteredAppointments: number;
  onViewChange: (view: AppointmentViewMode) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  selectionCount: number;
  selectedCount: number;
};

const PAGE_SIZE = 8;
const statusOrder: Record<string, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  RESCHEDULED: 2,
  COMPLETED: 3,
  NO_SHOW: 4,
  CANCELLED: 5,
};

const statusBadgeClasses: Record<string, string> = {
  CONFIRMED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  PENDING: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  CANCELLED: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  COMPLETED: "border-indigo-400/30 bg-indigo-400/10 text-indigo-200",
  RESCHEDULED: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  NO_SHOW: "border-orange-400/30 bg-orange-400/10 text-orange-200",
};

const quickChips: Array<{ value: QuickChip; label: string }> = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
  { value: "today", label: "Today" },
];

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No Show" },
];

const dateRangeFilters: Array<{ value: DateRangeFilter; label: string }> = [
  { value: "all", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "custom", label: "Custom" },
];

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "status", label: "By Status" },
  { value: "service", label: "By Service" },
];

function buildPlaceholderService(serviceId: number, name: string): Service {
  return {
    id: serviceId,
    organization_id: 0,
    name,
    description: null,
    duration_minutes: 0,
    capacity: 1,
    is_published: false,
    shareable_link: null,
    max_bookings_per_user: null,
    requires_advance_payment: false,
    advance_payment_amount: null,
    created_by: 0,
    created_at: new Date().toISOString(),
  };
}

function buildPlaceholderResource(resourceId: number, name: string): Resource {
  return {
    id: resourceId,
    organization_id: 0,
    name,
    type: "ROOM",
    description: null,
    capacity: 1,
    created_at: new Date().toISOString(),
    updated_at: null,
    deleted_at: null,
  };
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeStatus(value: string) {
  return value.toUpperCase().replace(/\s+/g, "_").trim();
}

function getQuickGroupKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getRelativeBucketLabel(date: Date, now: Date) {
  const days = differenceInCalendarDays(startOfDay(date), startOfDay(now));

  if (days === 0) {
    return "Today";
  }
  if (days === 1) {
    return "Tomorrow";
  }
  if (days === -1) {
    return "Yesterday";
  }
  if (days >= 2 && days <= 6) {
    return `This Week · ${format(date, "EEE, MMM d")}`;
  }
  if (days <= -2 && days >= -6) {
    return `Last Week · ${format(date, "EEE, MMM d")}`;
  }
  if (days >= 7 && days <= 13) {
    return `Next Week · ${format(date, "EEE, MMM d")}`;
  }
  return format(date, "EEE, MMM d");
}

function getRelativeTags(date: Date, now: Date) {
  const days = differenceInCalendarDays(startOfDay(date), startOfDay(now));
  const tags: string[] = [];

  if (days === 0) tags.push("today");
  if (days === 1) tags.push("tomorrow");
  if (days >= 2 && days <= 6) tags.push("this week");
  if (days <= -1 && days >= -6) tags.push("last week");
  if (days >= 7 && days <= 13) tags.push("next week");
  if (days < 0) tags.push("past");
  if (days > 0) tags.push("upcoming");

  return tags.join(" ");
}

function getRangeWindow(range: DateRangeFilter, from: string, to: string, now: Date) {
  if (range === "today") {
    const start = startOfDay(now);
    return { start, end: endOfDay(now) };
  }

  if (range === "week") {
    return {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
    };
  }

  if (range === "month") {
    return {
      start: startOfMonth(now),
      end: endOfMonth(now),
    };
  }

  if (range === "custom" && from && to) {
    const start = parseISO(from);
    const end = parseISO(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }
    return {
      start: startOfDay(start),
      end: endOfDay(end),
    };
  }

  return null;
}

function getStatusValue(status: string) {
  return normalizeStatus(status) as keyof typeof statusBadgeClasses;
}

function getAppointmentServiceName(
  appointment: Appointment,
  servicesById: Record<number, Service>,
  confirmationById: Record<number, AppointmentConfirmation>,
) {
  return (
    servicesById[appointment.service_id]?.name ??
    confirmationById[appointment.id]?.service_name ??
    `Service #${appointment.service_id}`
  );
}

function getAppointmentResourceName(
  appointment: Appointment,
  resourcesById: Record<number, Resource>,
  confirmationById: Record<number, AppointmentConfirmation>,
) {
  if (appointment.resource_id && resourcesById[appointment.resource_id]?.name) {
    return resourcesById[appointment.resource_id].name;
  }

  const resourceName = confirmationById[appointment.id]?.resource_name;
  if (resourceName) {
    return resourceName;
  }

  return appointment.resource_id ? `Resource #${appointment.resource_id}` : "Auto-assign";
}

function getAppointmentCapacityLabel(appointment: Appointment, servicesById: Record<number, Service>) {
  const service = servicesById[appointment.service_id];
  const capacity = Math.max(service?.capacity ?? appointment.capacity_used, 1);
  const used = Math.min(appointment.capacity_used, capacity);
  return { used, capacity };
}

function getStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function getRangeLabel(range: DateRangeFilter, from: string, to: string) {
  if (range === "today") return "Today";
  if (range === "week") return "This Week";
  if (range === "month") return "This Month";
  if (range === "custom" && from && to) {
    return `${format(parseISO(from), "MMM d")} - ${format(parseISO(to), "MMM d")}`;
  }
  return "All Dates";
}

function matchesSearchQuery(
  appointment: Appointment,
  query: string,
  serviceName: string,
  resourceName: string,
  now: Date,
) {
  if (!query) {
    return true;
  }

  const appointmentDate = new Date(appointment.start_time);
  const haystack = normalizeText(
    [
      serviceName,
      resourceName,
      appointment.status,
      getStatusLabel(appointment.status),
      format(appointmentDate, "yyyy-MM-dd"),
      format(appointmentDate, "EEE MMM d yyyy"),
      format(appointmentDate, "MMM d yyyy"),
      format(appointmentDate, "h:mm a"),
      getRelativeTags(appointmentDate, now),
    ].join(" "),
  );

  return normalizeText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function matchesDateRange(appointment: Appointment, range: DateRangeFilter, from: string, to: string, now: Date) {
  if (range === "all") {
    return true;
  }

  const appointmentDate = new Date(appointment.start_time);
  const window = getRangeWindow(range, from, to, now);

  if (!window) {
    return true;
  }

  return isWithinInterval(startOfDay(appointmentDate), {
    start: startOfDay(window.start),
    end: endOfDay(window.end),
  });
}

function matchesQuickChip(appointment: Appointment, chip: QuickChip, now: Date) {
  const appointmentStart = new Date(appointment.start_time);
  const appointmentEnd = new Date(appointment.end_time);

  switch (chip) {
    case "all":
      return true;
    case "upcoming":
      return appointment.status !== "CANCELLED" && isAfter(appointmentEnd, now);
    case "past":
      return isBefore(appointmentEnd, now) || ["CANCELLED", "COMPLETED", "NO_SHOW"].includes(appointment.status);
    case "cancelled":
      return appointment.status === "CANCELLED";
    case "today":
      return isSameDay(appointmentStart, now);
    default:
      return true;
  }
}

function compareAppointments(
  left: Appointment,
  right: Appointment,
  sort: SortOption,
  servicesById: Record<number, Service>,
  confirmations: Record<number, AppointmentConfirmation>,
) {
  const leftServiceName = getAppointmentServiceName(left, servicesById, confirmations);
  const rightServiceName = getAppointmentServiceName(right, servicesById, confirmations);

  switch (sort) {
    case "oldest":
      return new Date(left.start_time).getTime() - new Date(right.start_time).getTime();
    case "status":
      return (
        (statusOrder[left.status] ?? 99) - (statusOrder[right.status] ?? 99) ||
        new Date(left.start_time).getTime() - new Date(right.start_time).getTime()
      );
    case "service":
      return leftServiceName.localeCompare(rightServiceName) || new Date(left.start_time).getTime() - new Date(right.start_time).getTime();
    case "newest":
    default:
      return new Date(right.start_time).getTime() - new Date(left.start_time).getTime();
  }
}

function groupAppointmentsByDate(items: Appointment[], now: Date): GroupedAppointments[] {
  const groups = new Map<string, GroupedAppointments>();

  items.forEach((appointment) => {
    const date = startOfDay(new Date(appointment.start_time));
    const key = getQuickGroupKey(date);
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(appointment);
      return;
    }

    groups.set(key, {
      key,
      label: getRelativeBucketLabel(date, now),
      date,
      items: [appointment],
    });
  });

  return [...groups.values()].sort((left, right) => left.date.getTime() - right.date.getTime());
}

function countActiveFilters(filters: FilterState, searchQuery: string) {
  let count = 0;
  if (normalizeText(searchQuery).length > 0) count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.range !== "all") count += 1;
  if (filters.range === "custom" && (filters.from || filters.to)) count += 1;
  if (filters.chip !== "all") count += 1;
  return count;
}

function getDefaultFiltersFromParams(params: URLSearchParams): FilterState {
  return {
    status: (params.get("status") as StatusFilter) || "all",
    range: (params.get("range") as DateRangeFilter) || "all",
    from: params.get("from") || "",
    to: params.get("to") || "",
    chip: (params.get("chip") as QuickChip) || "all",
    sort: (params.get("sort") as SortOption) || "newest",
    view: (params.get("view") as AppointmentViewMode) || "list",
  };
}

function getQueryString(pathname: string, params: URLSearchParams) {
  const value = params.toString();
  return value ? `${pathname}?${value}` : pathname;
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return [] as HTMLElement[];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function SkeletonAppointmentCard() {
  return (
    <div className="glass overflow-hidden rounded-[30px] p-6">
      <div className="animate-pulse space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="h-3 w-28 rounded-full bg-white/10" />
            <div className="h-6 w-56 rounded bg-white/10" />
          </div>
          <div className="h-8 w-20 rounded-full bg-white/10" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="h-4 rounded bg-white/10" />
          <div className="h-4 rounded bg-white/10" />
          <div className="h-4 rounded bg-white/10" />
        </div>
        <div className="h-2 rounded-full bg-white/10" />
        <p className="text-sm text-slate-400">Loading appointment...</p>
      </div>
    </div>
  );
}

function LoadingMoreSkeleton() {
  return (
    <div className="space-y-4 pt-2">
      <SkeletonAppointmentCard />
      <SkeletonAppointmentCard />
    </div>
  );
}

function AppointmentsErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="glass rounded-[34px] border border-rose-400/30 bg-rose-950/30 p-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-200">
            <AlertCircle className="size-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Appointments unavailable</h2>
            <p className="mt-2 max-w-2xl text-sm text-rose-100/90">{message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
        >
          <RefreshCw className="size-4" />
          Retry
        </button>
      </div>
    </section>
  );
}

function EmptyState({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-[34px] border border-white/10 p-10 text-center">
      <div className="mx-auto flex size-20 items-center justify-center rounded-[28px] bg-white/5 text-slate-300">
        <Icon className="size-10" />
      </div>
      <h3 className="mt-6 text-2xl font-bold text-white">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">{description}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

function FilterBar({
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  activeFilterCount,
  onClearFilters,
  totalAppointments,
  filteredAppointments,
  onViewChange,
  onSelectAll,
  onDeselectAll,
  selectionCount,
  selectedCount,
}: FilterBarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const showClear = activeFilterCount > 0;

  return (
    <section className="glass rounded-[34px] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/90">Scheduling Suite</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">Appointments</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Search, filter, sort, and manage appointments from a premium command center.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
            Showing <span className="font-semibold text-white">{Math.min(filteredAppointments, totalAppointments)}</span> of <span className="font-semibold text-white">{totalAppointments}</span>
          </div>
          {showClear ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
            >
              Clear Filters
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setIsOpen((value) => !value)}
            className="relative inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:scale-[1.01] hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
          >
            <Filter className="size-4" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-slate-950 px-2 py-0.5 text-[11px] font-bold text-white">
                {activeFilterCount}
              </span>
            ) : null}
            <ChevronDown className={cn("size-4 transition-transform", isOpen ? "rotate-180" : "rotate-0")} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr]">
                <label className="glass flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 px-4 py-3">
                  <Search className="size-4 shrink-0 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder='Search service, resource, status, or date ("today", "tomorrow", "next week")'
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </label>

                <label className="glass flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 px-4 py-3">
                  <CalendarDays className="size-4 shrink-0 text-slate-400" />
                  <select
                    value={filters.status}
                    onChange={(event) => onFilterChange({ status: event.target.value as StatusFilter })}
                    className="w-full bg-transparent text-sm text-white outline-none"
                  >
                    {statusFilters.map((option) => (
                      <option key={option.value} value={option.value} className="bg-slate-950">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="glass flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 px-4 py-3">
                  <CalendarRange className="size-4 shrink-0 text-slate-400" />
                  <select
                    value={filters.range}
                    onChange={(event) => onFilterChange({ range: event.target.value as DateRangeFilter })}
                    className="w-full bg-transparent text-sm text-white outline-none"
                  >
                    {dateRangeFilters.map((option) => (
                      <option key={option.value} value={option.value} className="bg-slate-950">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="glass flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 px-4 py-3">
                  <Sparkles className="size-4 shrink-0 text-slate-400" />
                  <select
                    value={filters.sort}
                    onChange={(event) => onFilterChange({ sort: event.target.value as SortOption })}
                    className="w-full bg-transparent text-sm text-white outline-none"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value} className="bg-slate-950">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {filters.range === "custom" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="glass flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">From</span>
                    <input
                      type="date"
                      value={filters.from}
                      onChange={(event) => onFilterChange({ from: event.target.value })}
                      className="ml-auto rounded-xl bg-transparent text-sm text-white outline-none"
                    />
                  </label>
                  <label className="glass flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">To</span>
                    <input
                      type="date"
                      value={filters.to}
                      onChange={(event) => onFilterChange({ to: event.target.value })}
                      className="ml-auto rounded-xl bg-transparent text-sm text-white outline-none"
                    />
                  </label>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {quickChips.map((chip) => {
                    const active = filters.chip === chip.value;
                    return (
                      <motion.button
                        key={chip.value}
                        layout
                        type="button"
                        onClick={() => onFilterChange({ chip: chip.value })}
                        className={cn(
                          "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80",
                          active
                            ? "border-primary bg-primary text-slate-950"
                            : "border-white/10 bg-white/5 text-white hover:bg-white/10",
                        )}
                      >
                        {chip.label}
                      </motion.button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <div className="glass inline-flex items-center rounded-2xl border border-white/10 p-1">
                    {(["list", "calendar"] as const).map((mode) => {
                      const active = filters.view === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => onViewChange(mode)}
                          className={cn(
                            "inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80",
                            active
                              ? "bg-white text-slate-950"
                              : "text-slate-200 hover:bg-white/10",
                          )}
                        >
                          {mode === "list" ? <List className="size-4" /> : <CalendarIcon className="size-4" />}
                          {mode === "list" ? "List View" : "Calendar View"}
                        </button>
                      );
                    })}
                  </div>
                  <div className="glass inline-flex items-center rounded-2xl border border-white/10 p-1">
                    <button
                      type="button"
                      onClick={onSelectAll}
                      disabled={selectionCount === 0}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={onDeselectAll}
                      disabled={selectedCount === 0}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>Search matches service, resource, date, or status.</span>
                <span className="hidden size-1 rounded-full bg-white/30 sm:inline-flex" />
                <span>{getRangeLabel(filters.range, filters.from, filters.to)}</span>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function CancelAppointmentModal({
  appointment,
  serviceName,
  resourceName,
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  appointment: Appointment | null;
  serviceName: string;
  resourceName: string;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string | null) => void;
}) {
  const [reason, setReason] = useState("");
  const [isOther, setIsOther] = useState(false);
  const [customReason, setCustomReason] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) {
      previousFocusRef.current?.focus();
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const timeoutId = window.setTimeout(() => {
      const focusables = getFocusableElements(dialogRef.current);
      focusables[0]?.focus();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusables = getFocusableElements(dialogRef.current);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1)
        : (currentIndex === focusables.length - 1 ? 0 : currentIndex + 1);

      event.preventDefault();
      focusables[nextIndex]?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !appointment) {
    return null;
  }

  const finalReason = isOther ? customReason.trim() || null : reason ? reason : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-appointment-title"
        aria-describedby="cancel-appointment-description"
        initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.22 }}
        className="glass-premium relative w-full max-w-2xl overflow-hidden rounded-[34px] border border-white/10 p-6 shadow-2xl shadow-black/40"
      >
        <div className="absolute -right-20 -top-20 size-56 rounded-full bg-rose-500/20 blur-[90px]" />
        <div className="relative space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-200">Cancellation review</p>
              <h2 id="cancel-appointment-title" className="mt-2 text-3xl font-bold text-white">
                Cancel appointment?
              </h2>
              <p id="cancel-appointment-description" className="mt-2 text-sm text-slate-300">
                Review the details below before removing this booking from your calendar.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
              aria-label="Close cancellation dialog"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Service</p>
              <p className="mt-2 text-lg font-semibold text-white">{serviceName}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Resource</p>
              <p className="mt-2 text-lg font-semibold text-white">{resourceName}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Date</p>
              <p className="mt-2 text-lg font-semibold text-white">{formatDate(appointment.start_time)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Time</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Reason</span>
              <select
                value={reason}
                onChange={(event) => {
                  const value = event.target.value;
                  setReason(value);
                  if (value !== "OTHER") {
                    setIsOther(false);
                    setCustomReason("");
                  }
                }}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              >
                <option value="">No reason provided</option>
                <option value="Changed plans">Changed plans</option>
                <option value="Scheduling conflict">Scheduling conflict</option>
                <option value="Found another time">Found another time</option>
                <option value="No longer needed">No longer needed</option>
                <option value="OTHER">Other</option>
              </select>
            </label>

            {reason === "OTHER" ? (
              <label className="space-y-2 sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Custom reason</span>
                <input
                  value={customReason}
                  onChange={(event) => setCustomReason(event.target.value)}
                  placeholder="Optional note for your cancellation"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </label>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/15 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 disabled:opacity-60"
              disabled={isSubmitting}
            >
              Keep It
            </button>
            <button
              type="button"
              onClick={() => onConfirm(finalReason)}
              disabled={isSubmitting}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Cancelling...
                </>
              ) : (
                "Cancel Appointment"
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AppointmentCard({
  appointment,
  servicesById,
  resourcesById,
  confirmationById,
  onCancel,
  onOpen,
  onFocusMove,
  index,
  isOrganizer,
  isSelected,
  isReducedMotion,
  isAdmin,
  actionError,
  onToggleSelected,
  registerRef,
}: AppointmentCardProps) {
  const serviceName = getAppointmentServiceName(appointment, servicesById, confirmationById);
  const resourceName = getAppointmentResourceName(appointment, resourcesById, confirmationById);
  const statusKey = getStatusValue(appointment.status);
  const isCancelled = appointment.status === "CANCELLED";
  const canCancelAppointment = !isOrganizer || isAdmin;
  const now = new Date();
  const start = new Date(appointment.start_time);
  const end = new Date(appointment.end_time);
  const upcoming = isAfter(start, now) && !isCancelled;
  const relativeTime = upcoming ? formatDistanceToNow(start, { addSuffix: true }) : null;
  const capacity = getAppointmentCapacityLabel(appointment, servicesById);
  const progress = Math.min(100, Math.max(0, Math.round((capacity.used / capacity.capacity) * 100)));

  return (
    <motion.article
      ref={registerRef}
      role="listitem"
      tabIndex={0}
      aria-disabled={isCancelled ? "true" : undefined}
      aria-label={`${serviceName} appointment on ${formatDateTime(appointment.start_time)}`}
      layout
      initial={isReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={isReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, x: 32 }}
      whileHover={isReducedMotion ? undefined : { scale: 1.01, y: -2 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      onClick={() => onOpen(appointment.id)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          onFocusMove(index, 1);
        }
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          onFocusMove(index, -1);
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(appointment.id);
        }
      }}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_8px_28px_rgba(2,6,23,0.16)] outline-none transition focus-visible:ring-2 focus-visible:ring-primary/80",
        isCancelled ? "opacity-85" : "",
        isSelected ? "ring-2 ring-primary/40" : "",
        upcoming ? "border-l-4 border-l-primary" : "",
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-white/[0.02] opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <button
              type="button"
              aria-label={isSelected ? "Deselect appointment" : "Select appointment"}
              onClick={(event) => {
                event.stopPropagation();
                onToggleSelected(appointment.id);
              }}
              className="mt-1 inline-flex size-6 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
            >
              {isSelected ? <CheckCircle2 className="size-4 text-primary" /> : <CircleDashed className="size-4 text-slate-500" />}
            </button>

            <div className="flex size-14 shrink-0 items-center justify-center rounded-3xl bg-white/8 text-white shadow-lg shadow-black/10">
              <CalendarIcon className="size-7" />
            </div>

            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-xl font-bold text-white transition-colors group-hover:text-primary">
                  {serviceName}
                </h3>
                <span
                  aria-label={`Status: ${getStatusLabel(appointment.status)}`}
                  className={cn(
                    "inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
                    statusBadgeClasses[statusKey] ?? "border-white/10 bg-white/5 text-slate-200",
                  )}
                >
                  {getStatusLabel(appointment.status)}
                </span>
              </div>

              <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-slate-400" />
                  <span>{formatDate(appointment.start_time)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 className="size-4 text-slate-400" />
                  <span>
                    {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-slate-400" />
                  <span className="truncate">{resourceName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <History className="size-4 text-slate-400" />
                  <span>{upcoming ? `Starts ${relativeTime}` : `Ended ${formatDistanceToNow(end, { addSuffix: true })}`}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Capacity</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {capacity.used}/{capacity.capacity}
              </p>
              <div className="mt-2 h-2 w-28 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen(appointment.id);
              }}
              className="inline-flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
              aria-label={`Open appointment ${appointment.id}`}
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
              <Sparkles className="size-3.5 text-primary" />
              {upcoming ? "Upcoming appointment" : "Appointment history"}
            </div>

            {appointment.notes ? (
              <p className="max-w-3xl text-sm leading-6 text-slate-300">{appointment.notes}</p>
            ) : (
              <p className="max-w-3xl text-sm leading-6 text-slate-400">
                {isOrganizer ? "Organizer view shows the appointment timeline and capacity details." : "No extra notes were added for this booking."}
              </p>
            )}

            {actionError ? (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-100" aria-live="polite">
                {actionError}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {upcoming ? (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100">
                Starts in {formatDistanceToNow(start, { addSuffix: false })}
              </div>
            ) : null}

            {canCancelAppointment && !isCancelled ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCancel(appointment);
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
              >
                <XCircle className="size-4" />
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export default function AppointmentsPage() {
  const { user, isOrganizer } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion() ?? false;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [servicesById, setServicesById] = useState<Record<number, Service>>({});
  const [resourcesById, setResourcesById] = useState<Record<number, Resource>>({});
  const [confirmationById, setConfirmationById] = useState<Record<number, AppointmentConfirmation>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sectionWarnings, setSectionWarnings] = useState<string[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [cancelErrors, setCancelErrors] = useState<CardActionError>({});
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [now, setNow] = useState(() => new Date());
  const [showJumpToToday, setShowJumpToToday] = useState(false);

  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const loadMoreTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const params = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const filters = useMemo(() => getDefaultFiltersFromParams(params), [params]);
  const searchQuery = params.get("q") || "";
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const currentPage = Math.max(1, Number(params.get("page") || "1") || 1);
  const activeFilterCount = countActiveFilters(filters, searchQuery);
  const isAdmin = Boolean(user?.roles?.includes("ADMIN"));
  const canCancel = !isOrganizer || isAdmin;

  const updateQuery = useCallback(
    (patch: Partial<Record<string, string | null>>, options?: { preservePage?: boolean }) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      });
      if (!options?.preservePage) {
        next.set("page", "1");
      }
      router.replace(getQueryString(pathname, next), { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const loadAppointments = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError(null);
    setSectionWarnings([]);

    try {
      const appointmentData = await apiFetch<Appointment[]>('/api/appointments');
      const uniqueServiceIds = Array.from(new Set(appointmentData.map((appointment) => appointment.service_id)));

      const [serviceResults, resourceResults, confirmationResults] = await Promise.all([
        Promise.allSettled(uniqueServiceIds.map((serviceId) => apiFetch<Service>(`/api/services/${serviceId}`))),
        isOrganizer ? apiFetch<Resource[]>('/api/resources') : Promise.resolve([] as Resource[]),
        Promise.allSettled(
          appointmentData.map((appointment) => apiFetch<AppointmentConfirmation>(`/api/appointments/${appointment.id}/confirmation`)),
        ),
      ]);

      const serviceMap: Record<number, Service> = {};
      serviceResults.forEach((result, index) => {
        const serviceId = uniqueServiceIds[index];
        if (result.status === 'fulfilled') {
          serviceMap[serviceId] = result.value;
        }
      });

      const resourceMap: Record<number, Resource> = {};
      if (isOrganizer) {
        resourceResults.forEach((resource) => {
          resourceMap[resource.id] = resource;
        });
      }

      const confirmationMap: Record<number, AppointmentConfirmation> = {};
      const warnings: string[] = [];

      confirmationResults.forEach((result, index) => {
        if (result.status !== 'fulfilled') {
          return;
        }

        const appointment = appointmentData[index];
        const confirmation = result.value;
        confirmationMap[appointment.id] = confirmation;

        if (!serviceMap[appointment.service_id] && confirmation.service_name) {
          serviceMap[appointment.service_id] = buildPlaceholderService(appointment.service_id, confirmation.service_name);
        }

        if (appointment.resource_id && !resourceMap[appointment.resource_id] && confirmation.resource_name) {
          resourceMap[appointment.resource_id] = buildPlaceholderResource(appointment.resource_id, confirmation.resource_name);
        }
      });

      if (serviceResults.some((result) => result.status === 'rejected')) {
        warnings.push('Some service names could not be loaded, so fallbacks are shown in a few cards.');
      }
      if (isOrganizer && resourceResults.length === 0) {
        warnings.push('Organizer resources could not be loaded. Resource names may fall back to appointment confirmations.');
      }
      if (confirmationResults.some((result) => result.status === 'rejected')) {
        warnings.push('Some appointment confirmations could not be loaded. Search and display use best-effort fallbacks.');
      }

      setAppointments(appointmentData);
      setServicesById(serviceMap);
      setResourcesById(resourceMap);
      setConfirmationById(confirmationMap);
      setSectionWarnings(warnings);
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Unable to load appointments right now.'));
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  }, [isOrganizer]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAppointments();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadAppointments]);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (loadMoreTimerRef.current) {
      window.clearTimeout(loadMoreTimerRef.current);
    }
    if (isLoadingMore) {
      loadMoreTimerRef.current = window.setTimeout(() => setIsLoadingMore(false), 260);
    }
    return () => {
      if (loadMoreTimerRef.current) {
        window.clearTimeout(loadMoreTimerRef.current);
      }
    };
  }, [currentPage, isLoadingMore]);

  useEffect(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    if (!toast) {
      return;
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800);
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [toast]);

  useEffect(() => {
    const handleScroll = () => setShowJumpToToday(window.scrollY > 520);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { rootMargin: '160px' },
    );

    const target = document.getElementById('appointments-load-more-sentinel');
    if (target) {
      observer.observe(target);
    }
    return () => observer.disconnect();
  }, [isLoadingMore, hasMore, currentPage, loadMore]);

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((left, right) => compareAppointments(left, right, filters.sort, servicesById, confirmationById));
  }, [appointments, filters.sort, servicesById, confirmationById]);

  const filteredAppointments = useMemo(() => {
    return sortedAppointments.filter((appointment) => {
      const serviceName = getAppointmentServiceName(appointment, servicesById, confirmationById);
      const resourceName = getAppointmentResourceName(appointment, resourcesById, confirmationById);
      return (
        matchesSearchQuery(appointment, deferredSearchQuery, serviceName, resourceName, now) &&
        matchesDateRange(appointment, filters.range, filters.from, filters.to, now) &&
        (filters.status === 'all' || normalizeStatus(appointment.status).toLowerCase() === filters.status) &&
        matchesQuickChip(appointment, filters.chip, now)
      );
    });
  }, [sortedAppointments, deferredSearchQuery, filters, servicesById, resourcesById, confirmationById, now]);

  const groupedAppointments = useMemo(() => {
    const visible = filteredAppointments.slice(0, currentPage * PAGE_SIZE);
    return groupAppointmentsByDate(visible, now);
  }, [filteredAppointments, currentPage, now]);

  const visibleAppointments = useMemo(() => filteredAppointments.slice(0, currentPage * PAGE_SIZE), [filteredAppointments, currentPage]);
  const hasMore = filteredAppointments.length > visibleAppointments.length;
  const displayAppointments = visibleAppointments;
  const upcomingAppointments = useMemo(
    () => filteredAppointments.filter((appointment) => isAfter(new Date(appointment.start_time), now) && appointment.status !== 'CANCELLED'),
    [filteredAppointments, now],
  );
  const cancelledAppointments = useMemo(() => filteredAppointments.filter((appointment) => appointment.status === 'CANCELLED'), [filteredAppointments]);
  const pastAppointments = useMemo(
    () => filteredAppointments.filter((appointment) => isBefore(new Date(appointment.end_time), now) || ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)),
    [filteredAppointments, now],
  );

  const todayGroupId = useMemo(() => {
    const todayKey = getQuickGroupKey(startOfDay(now));
    return groupedAppointments.find((group) => group.key === todayKey)?.key ?? null;
  }, [groupedAppointments, now]);

  const visibleCount = displayAppointments.length;
  const totalAppointments = appointments.length;
  const selectedCount = selectedIds.length;
  const isSelectionActive = selectedCount > 0;
  const shouldShowNoResults = visibleCount === 0;
  const hasAnyAppointments = appointments.length > 0;
  const activeGroupCount = groupedAppointments.length;
  const totalCapacitySummary = useMemo(() => {
    const upcomingCount = upcomingAppointments.length;
    const cancelledCount = cancelledAppointments.length;
    const pastCount = pastAppointments.length;
    return { upcomingCount, cancelledCount, pastCount };
  }, [upcomingAppointments.length, cancelledAppointments.length, pastAppointments.length]);

  const loadMore = useCallback(() => {
    if (!hasMore) {
      return;
    }
    setIsLoadingMore(true);
    updateQuery({ page: String(currentPage + 1) }, { preservePage: true });
  }, [currentPage, hasMore, updateQuery]);

  const onRetry = useCallback(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const clearFilters = useCallback(() => {
    updateQuery(
      {
        q: null,
        status: null,
        range: null,
        from: null,
        to: null,
        chip: null,
        page: null,
      },
      { preservePage: false },
    );
  }, [updateQuery]);

  const onFilterChange = useCallback(
    (patch: FilterPatch) => {
      const nextParams: Record<string, string | null> = {
        status: patch.status ?? filters.status,
        range: patch.range ?? filters.range,
        from: patch.from ?? filters.from,
        to: patch.to ?? filters.to,
        chip: patch.chip ?? filters.chip,
        sort: patch.sort ?? filters.sort,
        view: patch.view ?? filters.view,
      };
      if (nextParams.range !== 'custom') {
        nextParams.from = null;
        nextParams.to = null;
      }
      updateQuery(nextParams, { preservePage: false });
    },
    [filters, updateQuery],
  );

  const onViewChange = useCallback(
    (view: AppointmentViewMode) => {
      updateQuery({ view }, { preservePage: true });
    },
    [updateQuery],
  );

  const onSearchChange = useCallback(
    (value: string) => {
      updateQuery({ q: value || null }, { preservePage: false });
    },
    [updateQuery],
  );

  const onOpenAppointment = useCallback(
    (appointmentId: number) => {
      router.push(`/appointments/${appointmentId}`);
    },
    [router],
  );

  const onFocusMove = useCallback(
    (currentIndex: number, direction: 1 | -1) => {
      const nextIndex = Math.max(0, Math.min(displayAppointments.length - 1, currentIndex + direction));
      cardRefs.current[nextIndex]?.focus();
    },
    [displayAppointments.length],
  );

  const onToggleSelected = useCallback((appointmentId: number) => {
    setSelectedIds((current) =>
      current.includes(appointmentId) ? current.filter((id) => id !== appointmentId) : [...current, appointmentId],
    );
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(displayAppointments.map((appointment) => appointment.id));
  }, [displayAppointments]);

  const deselectAll = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const openCancelDialog = useCallback((appointment: Appointment) => {
    setCancelErrors((current) => ({ ...current, [appointment.id]: '' }));
    setCancelTarget(appointment);
  }, []);

  const closeCancelDialog = useCallback(() => {
    if (isCancelling) {
      return;
    }
    setCancelTarget(null);
  }, [isCancelling]);

  const handleCancel = useCallback(
    async (reason: string | null) => {
      if (!cancelTarget) {
        return;
      }

      setIsCancelling(true);
      setCancelErrors((current) => ({ ...current, [cancelTarget.id]: '' }));

      try {
        await apiFetch(`/api/appointments/${cancelTarget.id}`, {
          method: 'DELETE',
          body: reason ? JSON.stringify({ cancellation_reason: reason }) : undefined,
        });

        setAppointments((current) => current.filter((appointment) => appointment.id !== cancelTarget.id));
        setSelectedIds((current) => current.filter((id) => id !== cancelTarget.id));
        setToast({ id: Date.now(), message: 'Appointment cancelled', tone: 'success' });
        setCancelTarget(null);
      } catch (error) {
        setCancelErrors((current) => ({
          ...current,
          [cancelTarget.id]: getErrorMessage(error, 'Unable to cancel this appointment.'),
        }));
        setToast({ id: Date.now(), message: 'Cancellation failed', tone: 'error' });
      } finally {
        setIsCancelling(false);
      }
    },
    [cancelTarget],
  );

  const jumpToToday = useCallback(() => {
    const target = todayGroupId ? document.getElementById(`appointment-group-${todayGroupId}`) : null;
    target?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, [reduceMotion, todayGroupId]);

  useEffect(() => {
    const currentSelection = new Set(selectedIds);
    if (currentSelection.size === 0) {
      return;
    }
    const visibleIds = new Set(displayAppointments.map((appointment) => appointment.id));
    if ([...currentSelection].some((id) => !visibleIds.has(id))) {
      setSelectedIds([...currentSelection].filter((id) => visibleIds.has(id)));
    }
  }, [displayAppointments, selectedIds]);

  const toastNode = toast ? (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      className={cn(
        'fixed right-6 top-6 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur',
        toast.tone === 'error'
          ? 'border-rose-400/30 bg-rose-950/80 text-rose-100'
          : 'border-emerald-400/30 bg-emerald-950/80 text-emerald-100',
      )}
      role="status"
      aria-live="polite"
    >
      {toast.tone === 'error' ? <XCircle className="size-5" /> : <CheckCircle2 className="size-5" />}
      <span className="text-sm font-medium">{toast.message}</span>
    </motion.div>
  ) : null;

  const activeView = filters.view;
  const currentSelectionCount = selectedCount;
  const filterPanelLabel = activeFilterCount > 0 ? `${activeFilterCount} active` : 'No active filters';

  const selectedDateAppointments = useMemo(() => {
    if (activeView !== 'calendar') {
      return [] as Appointment[];
    }
    return filteredAppointments.filter((appointment) => isSameDay(new Date(appointment.start_time), selectedDate));
  }, [activeView, filteredAppointments, selectedDate]);

  const calendarRangeAppointments = useMemo(() => {
    if (activeView !== 'calendar') {
      return [] as Appointment[];
    }
    return filteredAppointments.filter((appointment) => {
      const date = new Date(appointment.start_time);
      return isWithinInterval(date, {
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate),
      });
    });
  }, [activeView, filteredAppointments, selectedDate]);

  const topSummary = useMemo(() => {
    return [
      { label: 'Upcoming', value: upcomingAppointments.length, tone: 'emerald' },
      { label: 'Past', value: pastAppointments.length, tone: 'indigo' },
      { label: 'Cancelled', value: cancelledAppointments.length, tone: 'rose' },
      { label: 'Groups', value: activeGroupCount, tone: 'sky' },
    ];
  }, [upcomingAppointments.length, pastAppointments.length, cancelledAppointments.length, activeGroupCount]);

  if (loadError && !appointments.length) {
    return (
      <div className="space-y-8 pb-20">
        <AppointmentsErrorState message={loadError} onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      <AnimatePresence>{toastNode}</AnimatePresence>

      <section className="glass-premium relative overflow-hidden rounded-[38px] p-6 sm:p-8">
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-primary/15 blur-[110px]" />
        <div className="absolute -left-24 bottom-0 size-72 rounded-full bg-sky-500/10 blur-[120px]" />

        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-primary/90">
              <LayoutGrid className="size-3.5" />
              {isOrganizer ? 'Organizer Console' : 'Personal Schedule'}
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-slate-200">
                {filterPanelLabel}
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {isOrganizer ? 'Manage the booking stream' : 'Your appointments, refined'}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              Search by service, resource, date, or status. Filter by status and date range, switch between list and calendar views, and cancel appointments in a dedicated review modal.
            </p>
            {isRefreshing ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <RefreshCw className="size-3.5 animate-spin" />
                Refreshing live data
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {topSummary.map((summary) => (
              <div key={summary.label} className="glass rounded-[28px] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{summary.label}</p>
                <p className="mt-2 text-3xl font-bold text-white">{summary.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {sectionWarnings.length ? (
        <div className="glass rounded-[28px] border border-amber-400/30 bg-amber-950/30 p-5 text-sm text-amber-100" role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            <CircleDashed className="mt-0.5 size-5 shrink-0 text-amber-200" />
            <div className="space-y-1">
              <p className="font-semibold text-white">Partial data loaded</p>
              {sectionWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        filters={filters}
        onFilterChange={onFilterChange}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
        totalAppointments={totalAppointments}
        filteredAppointments={visibleCount}
        onViewChange={onViewChange}
        onSelectAll={selectAllVisible}
        onDeselectAll={deselectAll}
        selectionCount={displayAppointments.length}
        selectedCount={currentSelectionCount}
      />

      {isInitialLoading ? (
        <section className="space-y-4">
          <div className="grid gap-4">
            <SkeletonAppointmentCard />
            <SkeletonAppointmentCard />
            <SkeletonAppointmentCard />
            <SkeletonAppointmentCard />
          </div>
          <p className="text-center text-sm text-slate-400">Loading appointments...</p>
        </section>
      ) : loadError ? (
        <AppointmentsErrorState message={loadError} onRetry={onRetry} />
      ) : activeView === 'calendar' ? (
        <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="glass rounded-[34px] p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <CalendarIcon className="size-5 text-primary" />
              <h2 className="text-xl font-bold text-white">Calendar View</h2>
            </div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-[24px] border border-white/10 bg-white/[0.03] p-3"
            />
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
              {calendarRangeAppointments.length} appointments in {format(selectedDate, 'MMMM yyyy')}
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass rounded-[34px] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Selected date</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">{format(selectedDate, 'EEEE, MMMM d')}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDate(new Date())}
                  className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
                >
                  Jump to Today
                </button>
              </div>
            </div>

            <div role="list" className="space-y-4">
              <AnimatePresence initial={false} mode="popLayout">
                {selectedDateAppointments.length === 0 ? (
                  <EmptyState
                    key="calendar-empty"
                    title="No appointments on this date"
                    description="Change the date above or refine your search and filters to see matching bookings here."
                    icon={CalendarDays}
                    action={
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex min-h-11 items-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
                      >
                        Clear Filters
                      </button>
                    }
                  />
                ) : (
                  selectedDateAppointments.map((appointment, index) => (
                    <AppointmentCard
                      key={appointment.id}
                      index={index}
                      appointment={appointment}
                      servicesById={servicesById}
                      resourcesById={resourcesById}
                      confirmationById={confirmationById}
                      onCancel={openCancelDialog}
                      onOpen={onOpenAppointment}
                      onFocusMove={onFocusMove}
                      isOrganizer={isOrganizer}
                      isSelected={selectedIds.includes(appointment.id)}
                      isReducedMotion={reduceMotion}
                      isAdmin={isAdmin}
                      actionError={cancelErrors[appointment.id]}
                      onToggleSelected={onToggleSelected}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>
      ) : shouldShowNoResults ? (
        hasAnyAppointments && activeFilterCount > 0 ? (
          <EmptyState
            title="No appointments match your filters"
            description="Try broadening the search, changing the status or date range, or clearing the quick chips to see more results."
            icon={Filter}
            action={
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex min-h-11 items-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
              >
                Clear Filters
              </button>
            }
          />
        ) : hasAnyAppointments && totalCapacitySummary.upcomingCount === 0 ? (
          <EmptyState
            title="No upcoming appointments"
            description="You only have past or cancelled bookings right now. Switch to the past chip or browse your history."
            icon={Undo2}
            action={
              <button
                type="button"
                onClick={() => onFilterChange({ chip: 'past' })}
                className="inline-flex min-h-11 items-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
              >
                View Past
              </button>
            }
          />
        ) : (
          <EmptyState
            title="No appointments yet"
            description="Browse the service catalog to create your first booking. Once appointments exist, they will appear here with filtering, sorting, and calendar views."
            icon={Sparkles}
            action={
              <Link
                href="/"
                className="inline-flex min-h-11 items-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
              >
                Browse Services
              </Link>
            }
          />
        )
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-slate-300">
            <p>
              Showing <span className="font-semibold text-white">{visibleCount}</span> of <span className="font-semibold text-white">{filteredAppointments.length}</span> filtered appointments
            </p>
            <p className="hidden sm:block">
              {currentSelectionCount > 0 ? `${currentSelectionCount} selected` : `${groupedAppointments.length} date groups`}
            </p>
          </div>

          {isSelectionActive ? (
            <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-[26px] border border-white/10 bg-slate-950/90 px-5 py-4 shadow-2xl shadow-black/35 backdrop-blur">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Selection mode</p>
                <p className="mt-1 text-sm text-white">{currentSelectionCount} appointments selected</p>
              </div>
              <button
                type="button"
                onClick={deselectAll}
                className="inline-flex min-h-11 items-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
              >
                Deselect All
              </button>
            </div>
          ) : null}

          <div role="list" className="space-y-4">
            <AnimatePresence initial={false} mode="popLayout">
              {groupedAppointments.map((group) => (
                <motion.section key={group.key} layout className="space-y-3">
                  <div
                    id={`appointment-group-${group.key}`}
                    className="sticky top-24 z-20 rounded-2xl border border-white/10 bg-slate-950/85 px-4 py-3 backdrop-blur"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Date Group</p>
                        <h2 className="mt-1 text-lg font-bold text-white">{group.label}</h2>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                        {group.items.length} {group.items.length === 1 ? 'appointment' : 'appointments'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {group.items.map((appointment, index) => (
                      <AppointmentCard
                        key={appointment.id}
                        index={index}
                        appointment={appointment}
                        servicesById={servicesById}
                        resourcesById={resourcesById}
                        confirmationById={confirmationById}
                        onCancel={openCancelDialog}
                        onOpen={onOpenAppointment}
                        onFocusMove={onFocusMove}
                        isOrganizer={isOrganizer}
                        isSelected={selectedIds.includes(appointment.id)}
                        isReducedMotion={reduceMotion}
                        isAdmin={isAdmin}
                        actionError={cancelErrors[appointment.id]}
                        onToggleSelected={onToggleSelected}
                        registerRef={(node) => {
                          cardRefs.current[index] = node;
                        }}
                      />
                    ))}
                  </div>
                </motion.section>
              ))}
            </AnimatePresence>
          </div>

          {hasMore ? (
            <div className="space-y-4">
              {isLoadingMore ? <LoadingMoreSkeleton /> : null}
              <div className="flex flex-col items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={loadMore}
                  className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:scale-[1.01] hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
                >
                  <ArrowRight className="size-4" />
                  Load More
                </button>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Showing {visibleCount} of {filteredAppointments.length}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-center text-xs uppercase tracking-[0.18em] text-slate-400">
              Showing all {filteredAppointments.length} matching appointments
            </p>
          )}

          <div id="appointments-load-more-sentinel" className="h-1 w-full" aria-hidden="true" />
        </section>
      )}

      <AnimatePresence>
        {cancelTarget && canCancel ? (
          <CancelAppointmentModal
            appointment={cancelTarget}
            serviceName={getAppointmentServiceName(cancelTarget, servicesById, confirmationById)}
            resourceName={getAppointmentResourceName(cancelTarget, resourcesById, confirmationById)}
            isOpen={Boolean(cancelTarget)}
            isSubmitting={isCancelling}
            onClose={closeCancelDialog}
            onConfirm={(reason) => void handleCancel(reason)}
          />
        ) : null}
      </AnimatePresence>

      {showJumpToToday && todayGroupId ? (
        <button
          type="button"
          onClick={jumpToToday}
          className="fixed bottom-5 right-5 z-30 inline-flex min-h-12 items-center gap-2 rounded-full border border-white/10 bg-slate-950/90 px-5 py-3 text-sm font-semibold text-white shadow-2xl shadow-black/35 backdrop-blur transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
        >
          <CalendarDays className="size-4" />
          Jump to Today
        </button>
      ) : null}
    </div>
  );
}
