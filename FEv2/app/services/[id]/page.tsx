"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDate, formatTime, toDateInputValue } from "@/lib/format";
import { loadRazorpayScript } from "@/lib/razorpay";
import { useAuth } from "@/components/auth-provider";
import type {
  Appointment,
  AvailableSlot,
  FormQuestion,
  PaymentStatus,
  RazorpayOrderResponse,
  Resource,
  Service,
} from "@/lib/types";

function parseOptions(input?: string | null) {
  if (!input) {
    return [];
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
    if (parsed && typeof parsed === "object" && "options" in parsed) {
      const options = (parsed as { options?: unknown }).options;
      if (Array.isArray(options)) {
        return options.map(String);
      }
    }
  } catch {
    return input.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function getBookingLimitHint(limit?: number | null) {
  if (!limit) {
    return null;
  }

  if (limit === 1) {
    return "This service allows 1 active upcoming booking per customer.";
  }

  return `This service allows ${limit} active upcoming bookings per customer.`;
}

export default function ServicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const serviceId = Number(params.id);

  const [service, setService] = useState<Service | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date(Date.now() + 86400000)));
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [notes, setNotes] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  const selectedResource = useMemo(
    () => resources.find((resource) => resource.id === selectedSlot?.resource_id) ?? null,
    [resources, selectedSlot],
  );
  const bookingLimitHint = useMemo(
    () => getBookingLimitHint(service?.max_bookings_per_user),
    [service?.max_bookings_per_user],
  );

  useEffect(() => {
    let active = true;

    async function loadPage() {
      try {
        const [serviceData, resourceData, questionData] = await Promise.all([
          apiFetch<Service>(`/api/services/${serviceId}`, { skipAuth: true }),
          apiFetch<Resource[]>(`/api/services/${serviceId}/resources`, { skipAuth: true }),
          apiFetch<FormQuestion[]>(`/api/services/${serviceId}/form-questions`, { skipAuth: true }),
        ]);

        if (active) {
          setService(serviceData);
          setResources(resourceData);
          setQuestions(questionData);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load service");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadPage();
    return () => {
      active = false;
    };
  }, [serviceId]);

  useEffect(() => {
    let active = true;

    async function loadAvailability() {
      if (!serviceId || !selectedDate) {
        return;
      }

      setIsLoadingSlots(true);

      try {
        const data = await apiFetch<AvailableSlot[]>(
          `/api/services/${serviceId}/availability`,
          {
            skipAuth: true,
            params: { date: selectedDate },
          },
        );
        if (active) {
          setSlots(data);
          setSelectedSlot(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load slots");
          setSlots([]);
        }
      } finally {
        if (active) {
          setIsLoadingSlots(false);
        }
      }
    }

    void loadAvailability();
    return () => {
      active = false;
    };
  }, [selectedDate, serviceId]);

  async function handleBook() {
    if (!service) {
      setError("Service is not available.");
      return;
    }

    if (!selectedSlot) {
      setError("Pick a slot before booking.");
      return;
    }

    if (!isAuthenticated) {
      router.push(`/auth/login?next=${encodeURIComponent(`/services/${serviceId}`)}`);
      return;
    }

    const missingRequired = questions.some(
      (question) => question.is_required && !(answers[question.id] || "").trim(),
    );

    if (missingRequired) {
      setError("Answer all required booking questions.");
      return;
    }

    setIsBooking(true);
    setError(null);

    try {
      const appointment = await apiFetch<Appointment>("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          service_id: serviceId,
          resource_id: selectedSlot.resource_id,
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          capacity_used: 1,
          notes: notes || null,
        }),
      });

      const responses = questions
        .map((question) => ({
          question_id: question.id,
          response: (answers[question.id] || "").trim(),
        }))
        .filter((item) => item.response.length > 0);

      if (responses.length > 0) {
        await apiFetch(`/api/appointments/${appointment.id}/form-responses`, {
          method: "POST",
          body: JSON.stringify({ responses }),
        });
      }

      if (service.requires_advance_payment && service.advance_payment_amount) {
        const scriptLoaded = await loadRazorpayScript();
        const RazorpayCheckout = window.Razorpay;
        if (!scriptLoaded || !RazorpayCheckout) {
          router.push(`/appointments/${appointment.id}?payment=failed`);
          return;
        }

        const order = await apiFetch<RazorpayOrderResponse>(
          `/api/payments/appointments/${appointment.id}/order`,
          {
            method: "POST",
          },
        );

        const paymentOutcome = await new Promise<"success" | "pending" | "failed">((resolve) => {
          const razorpay = new RazorpayCheckout({
            key: order.key_id,
            amount: order.amount,
            currency: order.currency,
            name: service.name,
            description: "Advance payment for appointment booking",
            order_id: order.order_id,
            prefill: {
              name: user ? `${user.first_name} ${user.last_name}`.trim() : "",
              email: user?.email || "",
              contact: user?.phone || "",
            },
            notes: {
              appointment_id: String(appointment.id),
              service_id: String(service.id),
            },
            handler: async (response: Record<string, string>) => {
              try {
                await apiFetch<PaymentStatus>(
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
                resolve("success");
              } catch {
                resolve("failed");
              }
            },
            modal: {
              ondismiss: () => resolve("pending"),
            },
            theme: {
              color: "#0f172a",
            },
          });

          razorpay.on("payment.failed", () => resolve("failed"));
          razorpay.open();
        });

        router.push(`/appointments/${appointment.id}?payment=${paymentOutcome}`);
        return;
      }

      router.push(`/appointments/${appointment.id}`);
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : "Booking failed");
    } finally {
      setIsBooking(false);
    }
  }

  if (isLoading) {
    return <p>Loading service...</p>;
  }

  if (!service) {
    return <p className="error">{error || "Service not found."}</p>;
  }

  return (
    <div className="page">
      <section className="panel">
        <h1>{service.name}</h1>
        <p>{service.description || "No description provided."}</p>
        <p>
          Duration: {service.duration_minutes} minutes | Capacity: {service.capacity}
        </p>
        {bookingLimitHint ? <p>{bookingLimitHint}</p> : null}
        {service.requires_advance_payment ? (
          <p>Advance payment required: {service.advance_payment_amount} {service.advance_payment_amount ? "INR" : ""}</p>
        ) : null}
        <p>
          <Link href="/">Back to home</Link>
        </p>
      </section>

      <section className="grid two">
        <div className="panel">
          <h2>Availability</h2>
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setError(null);
              }}
            />
          </label>
          {isLoadingSlots ? <p>Loading slots...</p> : null}
          <div className="list">
            {slots.map((slot) => (
              <button
                key={`${slot.resource_id}-${slot.start_time}`}
                type="button"
                className="item"
                onClick={() => {
                  setSelectedSlot(slot);
                  setError(null);
                }}
              >
                <strong>{formatTime(slot.start_time)} to {formatTime(slot.end_time)}</strong>
                <p>{slot.resource_name}</p>
                <p>{slot.available_capacity} available</p>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Booking</h2>
          <p>
            Selected slot:{" "}
            {selectedSlot
              ? `${formatDate(selectedSlot.start_time)} ${formatTime(selectedSlot.start_time)}`
              : "None"}
          </p>
          <p>Resource: {selectedResource?.name || selectedSlot?.resource_name || "None"}</p>

          <div className="form">
            {questions.map((question) => {
              const options = parseOptions(question.options);
              return (
                <label key={question.id} className="field">
                  <span>
                    {question.question_text} {question.is_required ? "*" : ""}
                  </span>
                  {question.field_type === "TEXTAREA" ? (
                    <textarea
                      value={answers[question.id] || ""}
                      onChange={(event) =>
                        setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                      }
                    />
                  ) : question.field_type === "SELECT" ? (
                    <select
                      value={answers[question.id] || ""}
                      onChange={(event) =>
                        setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                      }
                    >
                      <option value="">Select an option</option>
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : question.field_type === "CHECKBOX" ? (
                    <select
                      value={answers[question.id] || ""}
                      onChange={(event) =>
                        setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                      }
                    >
                      <option value="">Select</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <input
                      type={
                        question.field_type === "EMAIL"
                          ? "email"
                          : question.field_type === "PHONE"
                            ? "tel"
                            : question.field_type === "DATE"
                              ? "date"
                              : "text"
                      }
                      value={answers[question.id] || ""}
                      onChange={(event) =>
                        setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                      }
                    />
                  )}
                </label>
              );
            })}

            <label className="field">
              <span>Notes</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </div>

          {error ? <p className="error">{error}</p> : null}
          <button type="button" disabled={!selectedSlot || isBooking} onClick={() => void handleBook()}>
            {isBooking
              ? "Booking..."
              : isAuthenticated
                ? service.requires_advance_payment
                  ? "Book and pay advance"
                  : "Book appointment"
                : "Login to book"}
          </button>
        </div>
      </section>
    </div>
  );
}
