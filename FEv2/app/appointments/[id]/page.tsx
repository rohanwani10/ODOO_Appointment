"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { formatDateTime, toDateInputValue } from "@/lib/format";
import type {
  Appointment,
  AppointmentConfirmation,
  AvailableSlot,
  BookingFormResponse,
} from "@/lib/types";

export default function AppointmentDetailPage() {
  const params = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const appointmentId = Number(params.id);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [confirmation, setConfirmation] = useState<AppointmentConfirmation | null>(null);
  const [formResponses, setFormResponses] = useState<BookingFormResponse[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState(toDateInputValue());
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("CONFIRMED");
  const [cancellationReason, setCancellationReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadAppointment() {
    try {
      const [appointmentData, confirmationData, responseData] = await Promise.all([
        apiFetch<Appointment>(`/api/appointments/${appointmentId}`),
        apiFetch<AppointmentConfirmation>(`/api/appointments/${appointmentId}/confirmation`),
        apiFetch<BookingFormResponse[]>(`/api/appointments/${appointmentId}/form-responses`),
      ]);
      setAppointment(appointmentData);
      setConfirmation(confirmationData);
      setFormResponses(responseData);
      setSelectedDate(toDateInputValue(new Date(appointmentData.start_time)));
      setSelectedStatus(appointmentData.status);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load appointment");
    }
  }

  useEffect(() => {
    void loadAppointment();
  }, [appointmentId]);

  useEffect(() => {
    let active = true;

    async function loadSlots() {
      if (!appointment?.resource_id) {
        return;
      }

      try {
        const data = await apiFetch<AvailableSlot[]>(
          `/api/services/${appointment.service_id}/availability`,
          {
            params: {
              date: selectedDate,
              resource_id: String(appointment.resource_id),
            },
          },
        );

        if (active) {
          setSlots(data);
        }
      } catch {
        if (active) {
          setSlots([]);
        }
      }
    }

    void loadSlots();
    return () => {
      active = false;
    };
  }, [appointment, selectedDate]);

  async function handleCancel() {
    if (!appointment) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await apiFetch(`/api/appointments/${appointment.id}`, {
        method: "DELETE",
        body: JSON.stringify({
          cancellation_reason: cancellationReason || undefined,
        }),
      });
      setMessage("Appointment cancelled.");
      await loadAppointment();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel appointment");
    }
  }

  async function handleReschedule() {
    if (!appointment || !selectedSlotKey) {
      return;
    }

    const slot = slots.find(
      (entry) => `${entry.resource_id}-${entry.start_time}` === selectedSlotKey,
    );

    if (!slot) {
      setError("Pick a slot before rescheduling.");
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const updated = await apiFetch<Appointment>(
        `/api/appointments/${appointment.id}/reschedule`,
        {
          method: "PUT",
          body: JSON.stringify({
            start_time: slot.start_time,
            end_time: slot.end_time,
          }),
        },
      );
      setAppointment(updated);
      setMessage("Appointment rescheduled.");
      await loadAppointment();
    } catch (rescheduleError) {
      setError(
        rescheduleError instanceof Error ? rescheduleError.message : "Unable to reschedule appointment",
      );
    }
  }

  async function handleStatusUpdate() {
    if (!appointment) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await apiFetch(`/api/appointments/${appointment.id}/status`, {
        method: "PUT",
        body: JSON.stringify({
          status: selectedStatus,
        }),
      });
      setMessage("Appointment status updated.");
      await loadAppointment();
    } catch (statusError) {
      setError(
        statusError instanceof Error ? statusError.message : "Unable to update appointment status",
      );
    }
  }

  return (
    <RequireAuth>
      <div className="page">
        <section className="panel">
          <h1>Appointment detail</h1>
          {error ? <p className="error">{error}</p> : null}
          {message ? <p className="success">{message}</p> : null}
          {!appointment ? <p>Loading appointment...</p> : null}
          {appointment ? (
            <>
              <p>ID: {appointment.id}</p>
              <p>Status: {appointment.status}</p>
              <p>Start: {formatDateTime(appointment.start_time)}</p>
              <p>End: {formatDateTime(appointment.end_time)}</p>
              <p>Service: {confirmation?.service_name || appointment.service_id}</p>
              <p>Resource: {confirmation?.resource_name || appointment.resource_id || "Unassigned"}</p>
              <p>Capacity used: {appointment.capacity_used}</p>
              <p>Notes: {appointment.notes || confirmation?.notes || "None"}</p>
              <p>
                <Link href="/appointments">Back to appointments</Link>
              </p>
            </>
          ) : null}
        </section>

        {confirmation ? (
          <section className="panel">
            <h2>Confirmation snapshot</h2>
            <p>Created: {formatDateTime(confirmation.created_at)}</p>
            <p>Status at load: {confirmation.status}</p>
          </section>
        ) : null}

        <section className="panel">
          <h2>Submitted booking answers</h2>
          {!formResponses.length ? <p>No custom responses were submitted.</p> : null}
          <div className="list">
            {formResponses.map((response) => (
              <article key={response.id} className="item">
                <h3>{response.question_text}</h3>
                <p>{response.response}</p>
                <p>{formatDateTime(response.created_at)}</p>
              </article>
            ))}
          </div>
        </section>

        {appointment && !hasRole("ORGANIZER", "ADMIN") && appointment.status !== "CANCELLED" ? (
          <section className="grid two">
            <div className="panel">
              <h2>Cancel appointment</h2>
              <label className="field">
                <span>Cancellation reason</span>
                <input
                  value={cancellationReason}
                  onChange={(event) => setCancellationReason(event.target.value)}
                />
              </label>
              <button type="button" onClick={() => void handleCancel()}>
                Cancel appointment
              </button>
            </div>

            <div className="panel">
              <h2>Reschedule appointment</h2>
              <label className="field">
                <span>Date</span>
                <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              </label>
              <div className="field">
                <span>Available slots</span>
                <select value={selectedSlotKey} onChange={(event) => setSelectedSlotKey(event.target.value)}>
                  <option value="">Select a slot</option>
                  {slots.map((slot) => (
                    <option key={`${slot.resource_id}-${slot.start_time}`} value={`${slot.resource_id}-${slot.start_time}`}>
                      {formatDateTime(slot.start_time)} - {slot.resource_name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={() => void handleReschedule()}>
                Reschedule
              </button>
            </div>
          </section>
        ) : null}

        {appointment && hasRole("ORGANIZER", "ADMIN") ? (
          <section className="panel">
            <h2>Organizer controls</h2>
            <label className="field">
              <span>Status</span>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
              >
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="RESCHEDULED">RESCHEDULED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="NO_SHOW">NO_SHOW</option>
              </select>
            </label>
            <button type="button" onClick={() => void handleStatusUpdate()}>
              Update status
            </button>
          </section>
        ) : null}
      </div>
    </RequireAuth>
  );
}
