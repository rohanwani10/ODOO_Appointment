"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { addDays, formatDate, formatTime, toDateInputValue } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import type { Appointment } from "@/types/booking";
import type { Resource } from "@/types/resource";
import type { AvailableSlot, Service } from "@/types/service";

export default function ServiceBookingPage() {
  const params = useParams<{ serviceId: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const serviceId = Number(params?.serviceId);

  const [service, setService] = useState<Service | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    toDateInputValue(addDays(new Date(), 1)),
  );
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [notes, setNotes] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  const selectedResource = useMemo(() => {
    if (!selectedSlot) {
      return null;
    }

    return resources.find((resource) => resource.id === selectedSlot.resource_id) ?? null;
  }, [resources, selectedSlot]);

  useEffect(() => {
    let isCancelled = false;

    async function loadService() {
      if (!serviceId || Number.isNaN(serviceId)) {
        setPageError("Invalid service id.");
        setIsLoading(false);
        return;
      }

      try {
        const [serviceData, resourceData] = await Promise.all([
          apiFetch<Service>(`/api/services/${serviceId}`),
          apiFetch<Resource[]>(`/api/services/${serviceId}/resources`),
        ]);

        if (!isCancelled) {
          setService(serviceData);
          setResources(resourceData);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setPageError(getErrorMessage(loadError, "Unable to load this service."));
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadService();

    return () => {
      isCancelled = true;
    };
  }, [serviceId]);

  useEffect(() => {
    let isCancelled = false;

    async function loadAvailability() {
      if (!serviceId || Number.isNaN(serviceId) || !selectedDate) {
        return;
      }

      setIsLoadingSlots(true);
      setBookingError(null);

      try {
        const data = await apiFetch<AvailableSlot[]>(
          `/api/services/${serviceId}/availability`,
          { params: { date: selectedDate } },
        );

        if (!isCancelled) {
          setSlots(data);
          setSelectedSlot((current) =>
            current
              ? data.find(
                  (slot) =>
                    slot.start_time === current.start_time &&
                    slot.resource_id === current.resource_id,
                ) ?? null
              : null,
          );
        }
      } catch (loadError) {
        if (!isCancelled) {
          setBookingError(
            getErrorMessage(loadError, "Unable to load availability for this date."),
          );
          setSlots([]);
          setSelectedSlot(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSlots(false);
        }
      }
    }

    void loadAvailability();

    return () => {
      isCancelled = true;
    };
  }, [selectedDate, serviceId]);

  async function handleBooking() {
    if (!selectedSlot) {
      setBookingError("Select a slot before creating an appointment.");
      return;
    }

    if (!isAuthenticated) {
      router.push(`/auth/login?next=${encodeURIComponent(`/services/${serviceId}`)}`);
      return;
    }

    setIsBooking(true);
    setBookingError(null);

    try {
      const appointment = await apiFetch<Appointment>("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          service_id: serviceId,
          resource_id: selectedSlot.resource_id,
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          capacity_used: 1,
          notes: notes.trim() || null,
        }),
      });

      router.push(`/appointments/${appointment.id}`);
    } catch (error) {
      setBookingError(getErrorMessage(error, "Unable to create appointment."));
    } finally {
      setIsBooking(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-8">
          Loading service...
        </div>
      </div>
    );
  }

  if (pageError || !service) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-6 py-10 text-white">
        <div className="mx-auto max-w-5xl rounded-3xl border border-red-400/20 bg-red-500/10 p-8">
          <p className="text-lg font-semibold">Service unavailable</p>
          <p className="mt-2 text-sm text-red-100">
            {pageError || "Unable to load this service."}
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-sky-300/80">
              Appointment booking
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              {service.name}
            </h1>
            <p className="mt-3 max-w-3xl text-slate-300">
              {service.description || "Pick a date, review live availability, and confirm your appointment."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Browse services
            </Link>
            <Link
              href="/appointments"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
            >
              My appointments
            </Link>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Duration
            </p>
            <p className="mt-2 text-2xl font-semibold">{service.duration_minutes} min</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Capacity
            </p>
            <p className="mt-2 text-2xl font-semibold">{service.capacity}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Linked resources
            </p>
            <p className="mt-2 text-2xl font-semibold">{resources.length}</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Select date
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Live slot availability
                </h2>
              </div>

              <input
                type="date"
                value={selectedDate}
                min={toDateInputValue()}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-sky-400/70"
              />
            </div>

            <div className="mt-6 space-y-3">
              {isLoadingSlots ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                  Loading available slots...
                </div>
              ) : slots.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                  No available slots for {selectedDate}. Pick another date or ask the organizer to add more working hours.
                </div>
              ) : (
                <div className="grid gap-3">
                  {slots.map((slot) => {
                    const isSelected =
                      selectedSlot?.start_time === slot.start_time &&
                      selectedSlot.resource_id === slot.resource_id;

                    return (
                      <button
                        key={`${slot.resource_id}-${slot.start_time}`}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`rounded-2xl border p-4 text-left transition-colors ${
                          isSelected
                            ? "border-sky-300/40 bg-sky-400/10"
                            : "border-white/10 bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-white">
                              {formatTime(slot.start_time)} to {formatTime(slot.end_time)}
                            </p>
                            <p className="mt-1 text-sm text-slate-300">
                              {slot.resource_name}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
                            {slot.available_capacity} left
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Appointment summary
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {selectedSlot ? "Ready to confirm" : "Choose a slot"}
            </h2>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Service
                </p>
                <p className="mt-2 text-lg font-semibold text-white">{service.name}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Slot
                </p>
                {selectedSlot ? (
                  <>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {formatDate(selectedSlot.start_time)}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {formatTime(selectedSlot.start_time)} to {formatTime(selectedSlot.end_time)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-300">
                    No slot selected yet.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Resource
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {selectedResource?.name || selectedSlot?.resource_name || "Select a slot first"}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Notes for the appointment
                </label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  placeholder="Optional context for the organizer"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition-colors placeholder:text-slate-500 focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
                />
              </div>

              {!isAuthenticated && (
                <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                  Login is required to confirm an appointment.
                </div>
              )}

              {bookingError && (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
                  {bookingError}
                </div>
              )}

              <button
                type="button"
                disabled={isBooking || !selectedSlot}
                onClick={() => void handleBooking()}
                className="w-full rounded-full bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBooking
                  ? "Creating appointment..."
                  : isAuthenticated
                    ? "Confirm appointment"
                    : "Login to book"}
              </button>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
