"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/api";
import { formatDateTime, toDateInputValue } from "@/lib/format";
import { loadRazorpayScript } from "@/lib/razorpay";
import type {
  Appointment,
  AppointmentConfirmation,
  AvailableSlot,
  BookingFormResponse,
  PaymentStatus,
  RazorpayOrderResponse,
} from "@/lib/types";

interface VirtualMeeting {
  appointment_id: number;
  provider: string;
  meeting_id?: string;
  join_url: string;
  start_url?: string;
  recipient_email: string;
  sent_at: string;
}

export default function AppointmentDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { hasRole, user } = useAuth();
  const appointmentId = Number(params.id);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [confirmation, setConfirmation] = useState<AppointmentConfirmation | null>(null);
  const [formResponses, setFormResponses] = useState<BookingFormResponse[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState(toDateInputValue());
  const [selectedSlotKey, setSelectedSlotKey] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("CONFIRMED");
  const [cancellationReason, setCancellationReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sendingMeetingEmail, setSendingMeetingEmail] = useState(false);
  const [virtualMeeting, setVirtualMeeting] = useState<VirtualMeeting | null>(null);
  const [customerName, setCustomerName] = useState<string>("");

  async function loadAppointment() {
    try {
      const [appointmentData, confirmationData, responseData, paymentData] = await Promise.all([
        apiFetch<Appointment>(`/api/appointments/${appointmentId}`),
        apiFetch<AppointmentConfirmation>(`/api/appointments/${appointmentId}/confirmation`),
        apiFetch<BookingFormResponse[]>(`/api/appointments/${appointmentId}/form-responses`),
        apiFetch<PaymentStatus>(`/api/payments/appointments/${appointmentId}`),
      ]);
      setAppointment(appointmentData);
      setConfirmation(confirmationData);
      setFormResponses(responseData);
      setPaymentStatus(paymentData);
      setSelectedDate(toDateInputValue(new Date(appointmentData.start_time)));
      setSelectedStatus(appointmentData.status);

      // Extract customer name from confirmation
      if (confirmationData && confirmationData.customer_name) {
        setCustomerName(confirmationData.customer_name);
      }

      // Fetch virtual meeting if organizer
      if (hasRole("ORGANIZER", "ADMIN")) {
        try {
          const meetingData = await apiFetch<VirtualMeeting | null>(
            `/api/appointments/${appointmentId}/virtual-meeting`,
          );
          setVirtualMeeting(meetingData);
        } catch {
          // Virtual meeting might not exist yet, that's OK
          setVirtualMeeting(null);
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load appointment");
    }
  }

  useEffect(() => {
    void loadAppointment();
  }, [appointmentId]);

  useEffect(() => {
    const paymentState = searchParams.get("payment");
    if (paymentState === "success") {
      setMessage("Advance payment completed.");
    } else if (paymentState === "pending") {
      setMessage("Appointment created. Advance payment is still pending.");
    } else if (paymentState === "failed") {
      setMessage("Appointment created, but payment was not completed.");
    }
  }, [searchParams]);

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

  async function handlePayNow() {
    if (!appointment || !paymentStatus?.requires_payment || paymentStatus.is_paid) {
      return;
    }

    setError(null);
    setMessage(null);

    const scriptLoaded = await loadRazorpayScript();
    const RazorpayCheckout = window.Razorpay;
    if (!scriptLoaded || !RazorpayCheckout) {
      setError("Unable to load Razorpay Checkout.");
      return;
    }

    try {
      const order = await apiFetch<RazorpayOrderResponse>(
        `/api/payments/appointments/${appointment.id}/order`,
        {
          method: "POST",
        },
      );

      await new Promise<void>((resolve) => {
        const razorpay = new RazorpayCheckout({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: confirmation?.service_name || `Appointment #${appointment.id}`,
          description: "Advance payment for appointment booking",
          order_id: order.order_id,
          prefill: {
            name: user ? `${user.first_name} ${user.last_name}`.trim() : "",
            email: user?.email || "",
            contact: user?.phone || "",
          },
          notes: {
            appointment_id: String(appointment.id),
          },
          handler: async (response: Record<string, string>) => {
            try {
              const verified = await apiFetch<PaymentStatus>(
                `/api/payments/appointments/${appointment.id}/verify`,
                {
                  method: "POST",
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  }),
                },
              );
              setPaymentStatus(verified);
              setMessage("Advance payment completed.");
              await loadAppointment();
            } catch (paymentError) {
              setError(
                paymentError instanceof Error
                  ? paymentError.message
                  : "Unable to verify payment",
              );
            } finally {
              resolve();
            }
          },
          modal: {
            ondismiss: () => {
              setMessage("Payment was not completed.");
              resolve();
            },
          },
          theme: {
            color: "#0f172a",
          },
        });
        razorpay.on("payment.failed", () => {
          setMessage("Payment failed. You can try again.");
          resolve();
        });
        razorpay.open();
      });
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Unable to start payment");
    }
  }

<<<<<<< Updated upstream
  async function handleSendZoomMeetingEmail() {
    if (!appointment) {
      return;
    }

    setError(null);
    setMessage(null);
    setSendingMeetingEmail(true);

    try {
      const response = await apiFetch<VirtualMeeting>(`/api/appointments/${appointment.id}/zoom-share`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setVirtualMeeting(response);
      setMessage(`Zoom meeting link has been sent to ${response.recipient_email}.`);
      await loadAppointment();
    } catch (emailError) {
      setError(
        emailError instanceof Error ? emailError.message : "Unable to send Zoom meeting email",
      );
    } finally {
      setSendingMeetingEmail(false);
    }
  }

  async function handlePayNow() {
    if (!appointment || !paymentStatus?.requires_payment || paymentStatus.is_paid) {
      return;
    }

    setError(null);
    setMessage(null);

    const scriptLoaded = await loadRazorpayScript();
    const RazorpayCheckout = window.Razorpay;
    if (!scriptLoaded || !RazorpayCheckout) {
      setError("Unable to load Razorpay Checkout.");
      return;
    }

    try {
      const order = await apiFetch<RazorpayOrderResponse>(
        `/api/payments/appointments/${appointment.id}/order`,
        {
          method: "POST",
        },
      );

      await new Promise<void>((resolve) => {
        const razorpay = new RazorpayCheckout({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: confirmation?.service_name || `Appointment #${appointment.id}`,
          description: "Advance payment for appointment booking",
          order_id: order.order_id,
          prefill: {
            name: user ? `${user.first_name} ${user.last_name}`.trim() : "",
            email: user?.email || "",
            contact: user?.phone || "",
          },
          notes: {
            appointment_id: String(appointment.id),
          },
          handler: async (response: Record<string, string>) => {
            try {
              const verified = await apiFetch<PaymentStatus>(
                `/api/payments/appointments/${appointment.id}/verify`,
                {
                  method: "POST",
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  }),
                },
              );
              setPaymentStatus(verified);
              setMessage("Advance payment completed.");
              await loadAppointment();
            } catch (paymentError) {
              setError(
                paymentError instanceof Error
                  ? paymentError.message
                  : "Unable to verify payment",
              );
            } finally {
              resolve();
            }
          },
          modal: {
            ondismiss: () => {
              setMessage("Payment was not completed.");
              resolve();
            },
          },
          theme: {
            color: "#0f172a",
          },
        });
        razorpay.on("payment.failed", () => {
          setMessage("Payment failed. You can try again.");
          resolve();
        });
        razorpay.open();
      });
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Unable to start payment");
    }
  }

=======
>>>>>>> Stashed changes
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

        {paymentStatus?.requires_payment ? (
          <section className="panel">
            <h2>Advance payment</h2>
            <p>Amount: {paymentStatus.amount} {paymentStatus.currency}</p>
            <p>Status: {paymentStatus.is_paid ? "Paid" : paymentStatus.latest_payment?.status || "Pending"}</p>
            {paymentStatus.latest_payment?.razorpay_payment_id ? (
              <p>Payment reference: {paymentStatus.latest_payment.razorpay_payment_id}</p>
            ) : null}
            {!paymentStatus.is_paid && !hasRole("ORGANIZER", "ADMIN") ? (
              <button type="button" onClick={() => void handlePayNow()}>
                Pay advance now
              </button>
            ) : null}
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
          <>
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

            {virtualMeeting ? (
              <section className="panel">
                <h2>Zoom Meeting</h2>
                <p>Provider: {virtualMeeting.provider}</p>
                <p>Meeting Link: <a href={virtualMeeting.join_url} target="_blank" rel="noopener noreferrer">{virtualMeeting.join_url}</a></p>
                {virtualMeeting.start_url ? (
                  <p>Start URL: <a href={virtualMeeting.start_url} target="_blank" rel="noopener noreferrer">{virtualMeeting.start_url}</a></p>
                ) : null}
                <p>Recipient: {virtualMeeting.recipient_email}</p>
                <button
                  type="button"
                  onClick={() => window.open(virtualMeeting.join_url, "_blank")}
                >
                  Join Meeting Now
                </button>
              </section>
            ) : null}

            <section className="panel">
              <h2>Send Zoom Meeting Link</h2>
              <p>Will send to: <strong>{customerName || "Customer"}</strong></p>
              <button
                type="button"
                onClick={() => void handleSendZoomMeetingEmail()}
                disabled={sendingMeetingEmail}
              >
                {sendingMeetingEmail ? "Sending..." : "Send Zoom Meeting Link"}
              </button>
            </section>
          </>
        ) : null}
      </div>
    </RequireAuth>
  );
}
