"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { formatDate, formatDateTime, formatTime } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import type { Appointment } from "@/types/booking";
import type { Resource } from "@/types/resource";
import type { Service } from "@/types/service";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Mail,
  MapPin,
  RotateCcw,
  Sparkles,
  X,
  XCircle,
  ChevronRight,
  Edit3,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "framer-motion";

/**
 * Interface for appointment confirmation response
 */
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

/**
 * Interface for cancellation reason enum from backend
 */
type CancellationReason =
  | "schedule_conflict"
  | "no_longer_needed"
  | "found_better_option"
  | "other";

/**
 * Toast notification type
 */
interface Toast {
  id: string;
  type: "success" | "error";
  message: string;
}

/**
 * Status badge configuration
 */
interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  textColor: string;
}

/**
 * Utility: Get countdown text (e.g., "Starts in 2 hours 15 minutes")
 */
function getCountdownText(startTime: string, now: Date): string | null {
  const start = new Date(startTime);
  if (start <= now) return null;

  const diffMs = start.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Starting soon";
  if (diffMins < 60) return `Starts in ${diffMins} minute${diffMins > 1 ? "s" : ""}`;

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  let text = `Starts in ${hours} hour${hours > 1 ? "s" : ""}`;
  if (mins > 0) text += ` ${mins} minute${mins > 1 ? "s" : ""}`;
  return text;
}

/**
 * Utility: Get relative time text for past appointments
 */
function getRelativeTimeText(endTime: string, now: Date): string | null {
  const end = new Date(endTime);
  if (end >= now) return null;

  const diffMs = now.getTime() - end.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `Ended ${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  if (diffHours > 0)
    return `Ended ${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `Ended ${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
}

/**
 * Utility: Get status configuration for display
 */
function getStatusConfig(status: string): StatusConfig {
  const normalized = status.toUpperCase();
  switch (normalized) {
    case "CONFIRMED":
      return {
        label: "Confirmed",
        color: "border-emerald-400/30",
        bgColor: "bg-emerald-500/10",
        textColor: "text-emerald-300",
        icon: <CheckCircle2 className="h-4 w-4" />,
      };
    case "PENDING":
      return {
        label: "Pending",
        color: "border-amber-400/30",
        bgColor: "bg-amber-500/10",
        textColor: "text-amber-300",
        icon: <Clock3 className="h-4 w-4" />,
      };
    case "CANCELLED":
      return {
        label: "Cancelled",
        color: "border-red-400/30",
        bgColor: "bg-red-500/10",
        textColor: "text-red-300",
        icon: <XCircle className="h-4 w-4" />,
      };
    default:
      return {
        label: status,
        color: "border-slate-400/30",
        bgColor: "bg-slate-500/10",
        textColor: "text-slate-300",
        icon: <AlertCircle className="h-4 w-4" />,
      };
  }
}

/**
 * Utility: Generate .ics calendar file
 */
function generateIcsFile(
  appointment: Appointment,
  serviceName: string,
  resourceName?: string | null,
): string {
  const start = new Date(appointment.start_time).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const end = new Date(appointment.end_time).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const created = new Date(appointment.created_at).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const title = serviceName || `Appointment #${appointment.id}`;
  const description = resourceName ? `Resource: ${resourceName}` : "";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Odoo Appointment//EN",
    "BEGIN:VEVENT",
    `UID:appointment-${appointment.id}@odoo-appointment`,
    `DTSTAMP:${created}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

/**
 * Component: Status Badge
 */
function StatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status);
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${config.color} ${config.bgColor} ${config.textColor}`}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      {config.icon}
      {config.label}
    </motion.div>
  );
}

/**
 * Component: Action Button
 */
function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "primary",
  disabled = false,
  loading = false,
}: {
  icon: React.ComponentType<{ className: string }>;
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "destructive";
  disabled?: boolean;
  loading?: boolean;
}) {
  const variants = {
    primary: "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-400/30",
    secondary: "bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border-sky-400/30",
    destructive: "bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-400/30",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${variants[variant]} disabled:cursor-not-allowed disabled:opacity-50`}
      aria-label={label}
    >
      {loading ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

/**
 * Component: Detail Item
 */
function DetailItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className: string }>;
}) {
  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon className="mt-1 h-5 w-5 text-emerald-400/60 flex-shrink-0" />}
      <div className="flex-1">
        <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</dt>
        <dd className="mt-1 text-sm text-slate-100">{value}</dd>
      </div>
    </div>
  );
}

/**
 * Component: Cancel Modal
 */
function CancelAppointmentModal({
  isOpen,
  appointment,
  serviceName,
  resourceName,
  onConfirm,
  onCancel,
  isLoading,
}: {
  isOpen: boolean;
  appointment: Appointment | null;
  serviceName: string | null;
  resourceName: string | null;
  onConfirm: (reason?: string) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [selectedReason, setSelectedReason] = useState<CancellationReason | "">("");
  const [customReason, setCustomReason] = useState("");
  const focusRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (isOpen && focusRef.current) {
      focusRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  const handleConfirm = async () => {
    const reason =
      selectedReason === "other" ? customReason : (selectedReason || undefined);
    await onConfirm(reason);
  };

  if (!isOpen || !appointment) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? {} : { opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
            aria-hidden="true"
          />

          <motion.div
            initial={
              prefersReducedMotion
                ? {}
                : { opacity: 0, scale: 0.95, y: 20 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? {}
                : { opacity: 0, scale: 0.95, y: 20 }
            }
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2"
            onKeyDown={handleKeyDown}
          >
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur shadow-2xl">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    Cancel appointment?
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    This action cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-slate-400 hover:text-white"
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Appointment Details */}
              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Appointment Details
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-white font-medium">
                    {serviceName || `Service #${appointment.service_id}`}
                  </p>
                  <p className="text-slate-300">
                    {formatDate(appointment.start_time)} at{" "}
                    {formatTime(appointment.start_time)}
                  </p>
                  {resourceName && (
                    <p className="text-slate-300">
                      <MapPin className="inline h-3 w-3 mr-1" />
                      {resourceName}
                    </p>
                  )}
                </div>
              </div>

              {/* Reason Dropdown */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-white">
                  Cancellation reason (optional)
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => {
                    setSelectedReason(e.target.value as CancellationReason | "");
                    setCustomReason("");
                  }}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 transition-colors hover:border-white/20 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">Select a reason...</option>
                  <option value="schedule_conflict">Schedule conflict</option>
                  <option value="no_longer_needed">No longer needed</option>
                  <option value="found_better_option">Found better option</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Custom Reason Input */}
              {selectedReason === "other" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 overflow-hidden"
                >
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Please tell us why..."
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 transition-colors hover:border-white/20 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </motion.div>
              )}

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="flex-1 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Keep It
                </button>
                <button
                  ref={focusRef}
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={isLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading && (
                    <RotateCcw className="h-4 w-4 animate-spin" />
                  )}
                  {isLoading ? "Cancelling..." : "Cancel Appointment"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Component: Skeleton Loader
 */
function AppointmentSkeleton() {
  const prefersReducedMotion = useReducedMotion();
  const animationClass = prefersReducedMotion ? "" : "animate-pulse";

  return (
    <div className="space-y-8">
      {/* Header Skeleton */}
      <motion.section
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <div className={`h-3 w-32 rounded-full bg-white/10 ${animationClass}`} />
            <div className={`mt-4 h-10 w-3/4 rounded-lg bg-white/10 ${animationClass}`} />
            <div className={`mt-3 h-4 w-1/2 rounded-full bg-white/10 ${animationClass}`} />
          </div>
          <div className="flex gap-3">
            <div className={`h-10 w-32 rounded-full bg-white/10 ${animationClass}`} />
            <div className={`h-10 w-40 rounded-full bg-white/10 ${animationClass}`} />
          </div>
        </div>
      </motion.section>

      {/* Stat Cards Skeleton */}
      <motion.section
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`rounded-3xl border border-white/10 bg-slate-950/70 p-6 ${animationClass}`}
          >
            <div className="h-3 w-20 rounded-full bg-white/10" />
            <div className="mt-4 h-8 w-3/4 rounded-lg bg-white/10" />
          </div>
        ))}
      </motion.section>

      {/* Details Skeleton */}
      <motion.section
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"
      >
        <div className={`rounded-3xl border border-white/10 bg-slate-950/70 p-6 ${animationClass}`}>
          <div className="h-6 w-32 rounded-lg bg-white/10" />
          <div className="mt-5 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="h-3 w-16 rounded-full bg-white/10" />
                <div className="mt-2 h-4 w-24 rounded-full bg-white/10" />
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur ${animationClass}`}>
          <div className="h-6 w-20 rounded-lg bg-white/10" />
          <div className="mt-5 space-y-3">
            <div className="h-4 w-full rounded-full bg-white/10" />
            <div className="h-4 w-5/6 rounded-full bg-white/10" />
          </div>
        </div>
      </motion.section>
    </div>
  );
}

/**
 * Component: Error State
 */
function ErrorState({
  error,
  onRetry,
  notFound = false,
}: {
  error: string | null;
  onRetry: () => void;
  notFound?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur"
    >
      <div className="flex flex-col items-center text-center">
        <div className="rounded-full bg-red-500/20 p-4">
          {notFound ? (
            <AlertCircle className="h-8 w-8 text-red-300" />
          ) : (
            <AlertCircle className="h-8 w-8 text-red-300" />
          )}
        </div>

        <h2 className="mt-6 text-2xl font-semibold text-white">
          {notFound ? "Appointment not found" : "Unable to load appointment"}
        </h2>
        <p className="mt-2 max-w-md text-slate-300">
          {error ||
            (notFound
              ? "The appointment you're looking for doesn't exist or has been removed."
              : "We encountered an error while loading this appointment. Please try again.")}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>
          <Link
            href="/appointments"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Appointments
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Main Page Component
 */
export default function AppointmentDetailPage() {
  const params = useParams<{ appointmentId: string }>();
  const router = useRouter();
  const { isOrganizer } = useAuth();
  const appointmentId = Number(params?.appointmentId);
  const prefersReducedMotion = useReducedMotion();

  // State: Fetched data
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [resourceName, setResourceName] = useState<string | null>(null);

  // State: UI
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [now, setNow] = useState(new Date());

  // Update current time for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Load appointment and related data
   */
  const loadAppointment = useCallback(async () => {
    if (!appointmentId || Number.isNaN(appointmentId)) {
      setError("Invalid appointment ID.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch main appointment
      const baseAppointment = await apiFetch<Appointment>(
        `/api/appointments/${appointmentId}`,
      );
      setAppointment(baseAppointment);

      // Fetch service details
      try {
        const svc = await apiFetch<Service>(
          `/api/services/${baseAppointment.service_id}`,
        );
        setService(svc);
        setServiceName(svc.name);
      } catch {
        setServiceName(null);
      }

      // Fetch resource details
      if (baseAppointment.resource_id) {
        try {
          const resources = await apiFetch<Resource[]>("/api/resources");
          const res = resources.find(
            (item) => item.id === baseAppointment.resource_id,
          );
          if (res) {
            setResourceName(res.name);
          }
        } catch {
          setResourceName(null);
        }
      }

      // Try confirmation endpoint for fallback names
      try {
        const confirmation = await apiFetch<AppointmentConfirmation>(
          `/api/appointments/${appointmentId}/confirmation`,
        );
        // Use fallback names from confirmation endpoint if not already set
        if (confirmation.service_name && !serviceName) {
          setServiceName(confirmation.service_name);
        }
        if (confirmation.resource_name && !resourceName) {
          setResourceName(confirmation.resource_name);
        }
      } catch {
        // Fallback already handled above
      }
    } catch (loadError) {
      const errorMsg = getErrorMessage(loadError, "Unable to load appointment.");
      setError(errorMsg);
      // Check for 404 - appointment not found
      if (
        loadError instanceof Response ||
        (typeof loadError === "object" &&
          loadError !== null &&
          "status" in loadError &&
          loadError.status === 404)
      ) {
        setError("This appointment does not exist or has been removed.");
      }
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAppointment();
  }, [loadAppointment]);

  /**
   * Add toast notification
   */
  const addToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  /**
   * Handle appointment cancellation
   */
  const handleCancel = useCallback(
    async (reason?: string) => {
      if (!appointment) return;

      setIsCancelling(true);

      try {
        const body = reason ? { cancellation_reason: reason } : undefined;
        await apiFetch(`/api/appointments/${appointment.id}`, {
          method: "DELETE",
          body: body ? JSON.stringify(body) : undefined,
        });

        addToast("Appointment cancelled successfully", "success");
        setShowCancelModal(false);

        setTimeout(() => {
          router.push("/appointments");
        }, 1500);
      } catch (cancelError) {
        const errorMsg = getErrorMessage(
          cancelError,
          "Unable to cancel appointment.",
        );
        addToast(errorMsg, "error");
      } finally {
        setIsCancelling(false);
      }
    },
    [appointment, addToast, router],
  );

  /**
   * Handle add to calendar
   */
  const handleAddToCalendar = useCallback(() => {
    if (!appointment || !serviceName) return;

    try {
      const ics = generateIcsFile(appointment, serviceName, resourceName);
      const blob = new Blob([ics], { type: "text/calendar" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `appointment-${appointment.id}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      addToast("Calendar file downloaded", "success");
    } catch {
      addToast("Failed to generate calendar file", "error");
    }
  }, [appointment, serviceName, resourceName, addToast]);

  /**
   * Handle copy to clipboard
   */
  const handleCopyLink = useCallback(() => {
    const link = `${window.location.origin}/appointments/${appointment?.id}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        addToast("Link copied to clipboard", "success");
      })
      .catch(() => {
        addToast("Failed to copy link", "error");
      });
  }, [appointment, addToast]);

  // Check authorization
  const canCancel = appointment && !isOrganizer && appointment.status !== "CANCELLED";

  // Formatted values
  const countdown = useMemo(
    () => appointment && getCountdownText(appointment.start_time, now),
    [appointment, now],
  );

  const relativeTime = useMemo(
    () => appointment && getRelativeTimeText(appointment.end_time, now),
    [appointment, now],
  );

  const statusConfig = useMemo(
    () => appointment && getStatusConfig(appointment.status),
    [appointment],
  );

  // Render loading
  if (isLoading) {
    return <AppointmentSkeleton />;
  }

  // Render error
  if (error || !appointment) {
    return (
      <ErrorState
        error={error}
        onRetry={loadAppointment}
        notFound={error?.includes("does not exist")}
      />
    );
  }

  // Render main content
  return (
    <div className="space-y-8">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? {} : { opacity: 0, y: -20 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm rounded-full border border-white/10 bg-white/5 px-6 py-3 backdrop-blur"
          >
            <p className={toast.type === "success" ? "text-emerald-300" : "text-red-300"}>
              {toast.message}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Breadcrumbs */}
      <motion.nav
        initial={prefersReducedMotion ? {} : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2 text-sm text-slate-400"
      >
        <Link href="/appointments" className="hover:text-slate-200 transition-colors">
          Appointments
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-white font-medium">
          {serviceName || `Appointment #${appointment.id}`}
        </span>
      </motion.nav>

      {/* Header Section */}
      <motion.section
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-8 backdrop-blur"
      >
        <div className="flex flex-col gap-6">
          {/* Title and Back */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-sky-300/80">
                Appointment details
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">
                {serviceName || `Service #${appointment.service_id}`}
              </h1>
              {countdown && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1.5 text-sm text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                  {countdown}
                </p>
              )}
              {relativeTime && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-500/20 px-3 py-1.5 text-sm text-slate-300">
                  <Clock3 className="h-4 w-4" />
                  {relativeTime}
                </p>
              )}
            </div>

            <Link
              href="/appointments"
              className="rounded-full border border-white/15 p-2.5 text-white transition-colors hover:bg-white/10"
              aria-label="Back to appointments"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </div>

          {/* Status and Quick Info */}
          <div className="flex flex-wrap items-center gap-3">
            {statusConfig && <StatusBadge status={appointment.status} />}
            <span className="text-sm text-slate-400">
              Appointment #{appointment.id}
            </span>
            <span className="text-sm text-slate-400">
              {formatDate(appointment.start_time)}
            </span>
          </div>
        </div>
      </motion.section>

      {/* Action Buttons Bar */}
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="flex flex-wrap gap-3"
      >
        <ActionButton
          icon={Download}
          label="Add to Calendar"
          onClick={handleAddToCalendar}
          variant="secondary"
        />
        <ActionButton
          icon={Copy}
          label="Share Link"
          onClick={handleCopyLink}
          variant="secondary"
        />
        <ActionButton
          icon={Mail}
          label="Contact Support"
          onClick={() => {
            window.location.href = `mailto:support@example.com?subject=Appointment ${appointment.id} Inquiry`;
          }}
          variant="secondary"
        />
        {canCancel && (
          <ActionButton
            icon={X}
            label="Cancel Appointment"
            onClick={() => setShowCancelModal(true)}
            variant="destructive"
            disabled={isCancelling}
          />
        )}
      </motion.div>

      {/* Stat Cards */}
      <motion.section
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        {/* Status Card */}
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Status
          </p>
          <p className="mt-4 text-2xl font-semibold text-white">
            {statusConfig?.label}
          </p>
        </div>

        {/* Date Card */}
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Date
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Calendar className="h-6 w-6 text-emerald-400/60" />
            <p className="text-2xl font-semibold text-white">
              {formatDate(appointment.start_time)}
            </p>
          </div>
        </div>

        {/* Time Card */}
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Time
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Clock3 className="h-6 w-6 text-sky-400/60" />
            <div>
              <p className="text-2xl font-semibold text-white">
                {formatTime(appointment.start_time)}
              </p>
              <p className="text-xs text-slate-400">
                {formatTime(appointment.end_time)}
              </p>
            </div>
          </div>
        </div>

        {/* Resource Card */}
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Resource
          </p>
          <div className="mt-4 flex items-center gap-3">
            <MapPin className="h-6 w-6 text-amber-400/60" />
            <p className="text-2xl font-semibold text-white">
              {resourceName || (appointment.resource_id ? `#${appointment.resource_id}` : "Unassigned")}
            </p>
          </div>
        </div>
      </motion.section>

      {/* Main Content Grid */}
      <motion.section
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"
      >
        {/* Booking Details */}
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <h2 className="text-xl font-semibold text-white">Booking details</h2>
          <dl className="mt-6 space-y-5">
            <DetailItem
              label="Start Time"
              value={formatDateTime(appointment.start_time)}
              icon={Clock3}
            />
            <DetailItem
              label="End Time"
              value={formatDateTime(appointment.end_time)}
              icon={Clock3}
            />
            <DetailItem
              label="Capacity Used"
              value={`${appointment.capacity_used} slot${appointment.capacity_used > 1 ? "s" : ""}`}
            />
            <DetailItem
              label="Created"
              value={formatDateTime(appointment.created_at)}
            />
            {service && (
              <>
                <DetailItem
                  label="Duration"
                  value={service.duration_minutes ? `${service.duration_minutes} minutes` : "N/A"}
                />
              </>
            )}
          </dl>
        </div>

        {/* Notes Section */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Notes</h2>
            {isOrganizer && (
              <button
                type="button"
                className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Edit notes"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-5">
            {appointment.notes ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-7 text-slate-300 whitespace-pre-wrap">
                {appointment.notes}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-white/10 bg-slate-950/30 p-4 text-sm text-slate-400 flex items-center justify-center gap-2 min-h-24">
                <MessageSquare className="h-4 w-4" />
                No notes added to this appointment
              </div>
            )}
          </div>
        </div>
      </motion.section>

      {/* Service Details Section */}
      {service && (
        <motion.section
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur"
        >
          <h2 className="text-xl font-semibold text-white">About this service</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {service.description && (
              <div>
                <h3 className="text-sm font-medium text-slate-300">Description</h3>
                <p className="mt-2 text-sm text-slate-400">{service.description}</p>
              </div>
            )}
            {service.duration_minutes && (
              <div>
                <h3 className="text-sm font-medium text-slate-300">Duration</h3>
                <p className="mt-2 text-sm text-slate-400">
                  {service.duration_minutes} minutes
                </p>
              </div>
            )}
          </div>
        </motion.section>
      )}

      {/* Timeline Section */}
      <motion.section
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur"
      >
        <h2 className="text-xl font-semibold text-white">Timeline</h2>
        <div className="mt-6 space-y-4">
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="h-3 w-3 rounded-full bg-emerald-400" />
              <div className="mt-2 w-0.5 h-12 bg-gradient-to-b from-emerald-400 to-transparent" />
            </div>
            <div className="pb-4">
              <p className="font-medium text-white">Created</p>
              <p className="text-sm text-slate-400">
                {formatDateTime(appointment.created_at)}
              </p>
            </div>
          </div>

          {appointment.status === "CONFIRMED" && (
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="h-3 w-3 rounded-full bg-sky-400" />
              </div>
              <div>
                <p className="font-medium text-white">Confirmed</p>
                <p className="text-sm text-slate-400">
                  Status changed to confirmed
                </p>
              </div>
            </div>
          )}

          {appointment.status === "CANCELLED" && (
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="h-3 w-3 rounded-full bg-red-400" />
              </div>
              <div>
                <p className="font-medium text-white">Cancelled</p>
                <p className="text-sm text-slate-400">
                  This appointment was cancelled
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.section>

      {/* Cancel Modal */}
      <CancelAppointmentModal
        isOpen={showCancelModal}
        appointment={appointment}
        serviceName={serviceName}
        resourceName={resourceName}
        onConfirm={handleCancel}
        onCancel={() => setShowCancelModal(false)}
        isLoading={isCancelling}
      />
    </div>
  );
}
