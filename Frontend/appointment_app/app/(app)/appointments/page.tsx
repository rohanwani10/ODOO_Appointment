"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import type { Appointment } from "@/types/booking";
import type { Resource } from "@/types/resource";
import type { Service } from "@/types/service";

export default function AppointmentsPage() {
  const { isOrganizer } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [servicesById, setServicesById] = useState<Record<number, Service>>({});
  const [resourcesById, setResourcesById] = useState<Record<number, Resource>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadAppointments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const appointmentData = await apiFetch<Appointment[]>("/api/appointments");
      const serviceIds = Array.from(new Set(appointmentData.map((item) => item.service_id)));

      const [serviceRecords, resourceRecords] = await Promise.all([
        Promise.all(
          serviceIds.map(async (serviceId) => {
            try {
              return await apiFetch<Service>(`/api/services/${serviceId}`);
            } catch {
              return null;
            }
          }),
        ),
        isOrganizer ? apiFetch<Resource[]>("/api/resources") : Promise.resolve([]),
      ]);

      const serviceMap = serviceRecords.reduce<Record<number, Service>>((accumulator, service) => {
        if (service) {
          accumulator[service.id] = service;
        }
        return accumulator;
      }, {});

      const resourceMap = resourceRecords.reduce<Record<number, Resource>>((accumulator, resource) => {
        accumulator[resource.id] = resource;
        return accumulator;
      }, {});

      setAppointments(appointmentData);
      setServicesById(serviceMap);
      setResourcesById(resourceMap);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load appointments."));
    } finally {
      setIsLoading(false);
    }
  }, [isOrganizer]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const sortedAppointments = useMemo(
    () =>
      [...appointments].sort(
        (left, right) =>
          new Date(left.start_time).getTime() - new Date(right.start_time).getTime(),
      ),
    [appointments],
  );

  async function handleCancel(appointmentId: number) {
    setCancellingId(appointmentId);
    setError(null);

    try {
      await apiFetch(`/api/appointments/${appointmentId}`, {
        method: "DELETE",
      });
      await loadAppointments();
    } catch (cancelError) {
      setError(getErrorMessage(cancelError, "Unable to cancel appointment."));
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-950/20 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-sky-300/80">
              Phase 2
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">
              {isOrganizer ? "Bookings on your services" : "Your appointments"}
            </h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              {isOrganizer
                ? "Track what customers are creating against your services."
                : "Review every appointment you have created and open a detailed overview for each one."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Browse services
            </Link>
            {isOrganizer && (
              <Link
                href="/organizer"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
              >
                Organizer workspace
              </Link>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-slate-300">
          Loading appointments...
        </div>
      ) : sortedAppointments.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/60 p-8 text-slate-300">
          <p className="text-lg font-semibold text-white">
            {isOrganizer ? "No bookings yet." : "No appointments yet."}
          </p>
          <p className="mt-2">
            {isOrganizer
              ? "Publish a service and add working hours to your resources to start receiving bookings."
              : "Published services from the home page will appear here after you book them."}
          </p>
        </div>
      ) : (
        <div className="grid gap-5">
          {sortedAppointments.map((appointment) => {
            const service = servicesById[appointment.service_id];
            const resource = appointment.resource_id
              ? resourcesById[appointment.resource_id]
              : null;

            return (
              <article
                key={appointment.id}
                className="rounded-3xl border border-white/10 bg-slate-950/70 p-6"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Appointment #{appointment.id}
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">
                        {service?.name || `Service #${appointment.service_id}`}
                      </h2>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Date
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {formatDate(appointment.start_time)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Time
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {formatTime(appointment.start_time)} to {formatTime(appointment.end_time)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Status
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {appointment.status}
                        </p>
                      </div>
                    </div>

                    <div className="text-sm text-slate-300">
                      <p>
                        Resource: {resource?.name || (appointment.resource_id ? `#${appointment.resource_id}` : "Unassigned")}
                      </p>
                      {appointment.notes && <p className="mt-2">Notes: {appointment.notes}</p>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 lg:flex-col lg:items-end">
                    <Link
                      href={`/appointments/${appointment.id}`}
                      className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300"
                    >
                      Open overview
                    </Link>
                    {!isOrganizer && appointment.status !== "CANCELLED" && (
                      <button
                        type="button"
                        disabled={cancellingId === appointment.id}
                        onClick={() => void handleCancel(appointment.id)}
                        className="rounded-full border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cancellingId === appointment.id ? "Cancelling..." : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
