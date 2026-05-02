"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import type { Service } from "@/types/service";

export default function Home() {
  const { isAuthenticated, isOrganizer } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadServices() {
      try {
        const data = await apiFetch<Service[]>("/api/services");
        if (!isCancelled) {
          setServices(data);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(getErrorMessage(loadError, "Unable to load services."));
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadServices();

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.2),transparent_32%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#111827_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-sky-300/80">
              Appointment Booking System
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Phase 2 showcase
            </h1>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href={isAuthenticated ? "/appointments" : "/auth/login"}
              className="rounded-full border border-white/15 px-4 py-2 text-white/85 transition-colors hover:bg-white/10"
            >
              {isAuthenticated ? "My appointments" : "Login"}
            </Link>
            {isOrganizer && (
              <Link
                href="/organizer"
                className="rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 font-medium text-sky-100 transition-colors hover:bg-sky-300/20"
              >
                Organizer workspace
              </Link>
            )}
            {!isAuthenticated && (
              <Link
                href="/auth/register"
                className="rounded-full bg-sky-400 px-4 py-2 font-medium text-slate-950 transition-colors hover:bg-sky-300"
              >
                Register
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 py-16">
          <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="inline-flex rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-sky-200">
                Customer booking flow
              </p>
              <h2 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">
                Browse published services, choose a slot, and track every booking.
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Phase 2 now covers the customer path end to end: service
                discovery, appointment creation, appointment list, and detailed
                overview screens.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={services[0] ? `/services/${services[0].id}` : "/appointments"}
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
                >
                  {services[0] ? "Book first service" : "Open appointments"}
                </Link>
                <Link
                  href="/appointments"
                  className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  View appointments
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-sky-950/20 backdrop-blur">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Services
                  </p>
                  <p className="mt-3 text-lg font-semibold">
                    Published catalog for customers
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Booking
                  </p>
                  <p className="mt-3 text-lg font-semibold">
                    Date, slot, resource, notes
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Organizer
                  </p>
                  <p className="mt-3 text-lg font-semibold">
                    Organization, resource, and service setup
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Overview
                  </p>
                  <p className="mt-3 text-lg font-semibold">
                    Appointment list and detail pages
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-16 space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Published services
                </p>
                <h3 className="text-3xl font-semibold tracking-tight text-white">
                  Ready for booking
                </h3>
              </div>
              {isOrganizer && (
                <Link
                  href="/organizer"
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Create service
                </Link>
              )}
            </div>

            {error && (
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-300">
                Loading services...
              </div>
            ) : services.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/60 p-8 text-slate-300">
                <p className="text-lg font-semibold text-white">
                  No published services yet.
                </p>
                <p className="mt-2">
                  Organizers can create resources and services from the organizer
                  workspace, then publish them here.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                {services.map((service) => (
                  <article
                    key={service.id}
                    className="rounded-3xl border border-white/10 bg-slate-950/65 p-6 shadow-xl shadow-slate-950/20"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-sky-300/80">
                          Service #{service.id}
                        </p>
                        <h4 className="mt-2 text-2xl font-semibold text-white">
                          {service.name}
                        </h4>
                      </div>
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
                        Published
                      </span>
                    </div>

                    <p className="mt-4 min-h-12 text-sm leading-7 text-slate-300">
                      {service.description || "No description added yet."}
                    </p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Duration
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {service.duration_minutes} min
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Capacity
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {service.capacity}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Payment
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {service.requires_advance_payment
                            ? `${service.advance_payment_amount ?? 0} upfront`
                            : "None"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">
                        Created {formatDateTime(service.created_at)}
                      </p>
                      <Link
                        href={`/services/${service.id}`}
                        className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300"
                      >
                        Book appointment
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
