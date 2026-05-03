"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Appointment, AppointmentConfirmation, BookingFormResponse } from "@/lib/types";

const statusOptions = ["PENDING", "CONFIRMED", "CANCELLED", "RESCHEDULED", "COMPLETED", "NO_SHOW"];

export default function OrganizerBookingsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<AppointmentConfirmation | null>(null);
  const [responses, setResponses] = useState<BookingFormResponse[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadAppointments() {
    try {
      const [appointmentData, calendarData] = await Promise.all([
        apiFetch<Appointment[]>("/api/appointments"),
        apiFetch<Record<string, unknown>[]>("/api/appointments/calendar"),
      ]);
      setAppointments(appointmentData);
      setCalendarEntries(calendarData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load organizer bookings");
    }
  }

  useEffect(() => {
    void loadAppointments();
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDetails() {
      if (!selectedAppointmentId) {
        setConfirmation(null);
        setResponses([]);
        return;
      }

      try {
        const [confirmationData, responseData] = await Promise.all([
          apiFetch<AppointmentConfirmation>(`/api/appointments/${selectedAppointmentId}/confirmation`),
          apiFetch<BookingFormResponse[]>(`/api/appointments/${selectedAppointmentId}/form-responses`),
        ]);

        if (active) {
          setConfirmation(confirmationData);
          setResponses(responseData);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load appointment details");
        }
      }
    }

    void loadDetails();
    return () => {
      active = false;
    };
  }, [selectedAppointmentId]);

  async function handleStatusUpdate(appointmentId: number, status: string) {
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch<{ message: string }>(`/api/appointments/${appointmentId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      setMessage(response.message);
      await loadAppointments();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update status");
    }
  }

  return (
    <RequireAuth allowedRoles={["ORGANIZER", "ADMIN"]}>
      <div className="page">
        <section className="panel">
          <h1>Organizer bookings</h1>
          {message ? <p className="success">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="grid two">
          <div className="panel">
            <h2>Appointments</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Service</th>
                    <th>Start</th>
                    <th>Status</th>
                    <th>Update</th>
                    <th>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td>{appointment.id}</td>
                      <td>{appointment.service_id}</td>
                      <td>{formatDateTime(appointment.start_time)}</td>
                      <td>{appointment.status}</td>
                      <td>
                        <select
                          defaultValue={appointment.status}
                          onChange={(event) => void handleStatusUpdate(appointment.id, event.target.value)}
                        >
                          {statusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button type="button" onClick={() => setSelectedAppointmentId(appointment.id)}>
                          Load
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h2>Selected appointment</h2>
            {confirmation ? (
              <>
                <p>Service: {confirmation.service_name || "-"}</p>
                <p>Resource: {confirmation.resource_name || "-"}</p>
                <p>Start: {formatDateTime(confirmation.start_time)}</p>
                <p>End: {formatDateTime(confirmation.end_time)}</p>
                <p>Notes: {confirmation.notes || "None"}</p>
                <h3>Booking form responses</h3>
                <div className="list">
                  {responses.map((response) => (
                    <article key={response.id} className="item">
                      <strong>{response.question_text}</strong>
                      <p>{response.response}</p>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p>Select an appointment to inspect details.</p>
            )}
          </div>
        </section>

        <section className="panel">
          <h2>Calendar feed</h2>
          <div className="list">
            {calendarEntries.map((entry) => (
              <article key={String(entry.id)} className="item">
                <p>ID: {String(entry.id)}</p>
                <p>Service: {String(entry.service_name ?? entry.service_id ?? "-")}</p>
                <p>Start: {String(entry.start_time ?? "-")}</p>
                <p>Status: {String(entry.status ?? "-")}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </RequireAuth>
  );
}
