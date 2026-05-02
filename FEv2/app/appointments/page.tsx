"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Appointment } from "@/lib/types";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadAppointments() {
      try {
        const data = await apiFetch<Appointment[]>("/api/appointments");
        if (active) {
          setAppointments(data);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load appointments");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadAppointments();
    return () => {
      active = false;
    };
  }, []);

  return (
    <RequireAuth>
      <div className="page">
        <section className="panel">
          <h1>Appointments</h1>
          {isLoading ? <p>Loading appointments...</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <div className="list">
            {appointments.map((appointment) => (
              <article key={appointment.id} className="item">
                <h3>Appointment #{appointment.id}</h3>
                <p>Status: {appointment.status}</p>
                <p>{formatDateTime(appointment.start_time)} to {formatDateTime(appointment.end_time)}</p>
                <Link href={`/appointments/${appointment.id}`}>Open details</Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </RequireAuth>
  );
}
