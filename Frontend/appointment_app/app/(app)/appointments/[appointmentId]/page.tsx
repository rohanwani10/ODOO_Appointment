"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { formatDate, formatDateTime, formatTime } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
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

export default function AppointmentOverviewPage() {
  const params = useParams<{ appointmentId: string }>();
  const router = useRouter();
  const { isOrganizer } = useAuth();
  const appointmentId = Number(params?.appointmentId);

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [resourceName, setResourceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadAppointment = useCallback(async () => {
    if (!appointmentId || Number.isNaN(appointmentId)) {
      setError("Invalid appointment id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const baseAppointment = await apiFetch<Appointment>(
        `/api/appointments/${appointmentId}`,
      );
      setAppointment(baseAppointment);

      const service = await apiFetch<Service>(
        `/api/services/${baseAppointment.service_id}`,
      );
      setServiceName(service.name);

      try {
        const confirmation = await apiFetch<AppointmentConfirmation>(
          `/api/appointments/${appointmentId}/confirmation`,
        );
        setResourceName(confirmation.resource_name || null);
      } catch {
        if (isOrganizer && baseAppointment.resource_id) {
          const resources = await apiFetch<Resource[]>("/api/resources");
          const resource = resources.find(
            (item) => item.id === baseAppointment.resource_id,
          );
          setResourceName(resource?.name || null);
        } else {
          setResourceName(null);
        }
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load appointment overview."));
    } finally {
      setIsLoading(false);
    }
  }, [appointmentId, isOrganizer]);

  useEffect(() => {
    void loadAppointment();
  }, [loadAppointment]);

  async function handleCancel() {
    if (!appointment) {
      return;
    }

    setIsCancelling(true);
    setError(null);

    try {
      await apiFetch(`/api/appointments/${appointment.id}`, { method: "DELETE" });
      router.push("/appointments");
    } catch (cancelError) {
      setError(getErrorMessage(cancelError, "Unable to cancel appointment."));
    } finally {
      setIsCancelling(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          Loading appointment overview...
        </section>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="space-y-8">
        <section className="rounded-3xl border border-red-400/20 bg-red-500/10 p-8">
          <p className="text-lg font-semibold text-white">Overview unavailable</p>
          <p className="mt-2 text-sm text-red-100">
            {error || "Unable to load appointment."}
          </p>
          <Link
            href="/appointments"
            className="mt-5 inline-flex rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Back to appointments
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-950/20 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-sky-300/80">
              Appointment overview
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">
              {serviceName || `Service #${appointment.service_id}`}
            </h1>
            <p className="mt-3 text-slate-300">
              Detailed view for appointment #{appointment.id}.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/appointments"
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Back to appointments
            </Link>
            {!isOrganizer && appointment.status !== "CANCELLED" && (
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => void handleCancel()}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCancelling ? "Cancelling..." : "Cancel appointment"}
              </button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Status
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {appointment.status}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Date
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {formatDate(appointment.start_time)}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Time
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {formatTime(appointment.start_time)}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Resource
          </p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {resourceName || (appointment.resource_id ? `#${appointment.resource_id}` : "Unassigned")}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <h2 className="text-xl font-semibold text-white">Booking details</h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Start
              </dt>
              <dd className="mt-2 text-sm text-slate-100">
                {formatDateTime(appointment.start_time)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">
                End
              </dt>
              <dd className="mt-2 text-sm text-slate-100">
                {formatDateTime(appointment.end_time)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Capacity used
              </dt>
              <dd className="mt-2 text-sm text-slate-100">
                {appointment.capacity_used}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Created
              </dt>
              <dd className="mt-2 text-sm text-slate-100">
                {formatDateTime(appointment.created_at)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="text-xl font-semibold text-white">Notes</h2>
          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-7 text-slate-300">
            {appointment.notes || "No notes were added to this appointment."}
          </div>
        </div>
      </section>
    </div>
  );
}
