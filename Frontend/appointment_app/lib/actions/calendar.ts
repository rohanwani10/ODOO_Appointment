"use server";

import { apiFetch } from "@/lib/api";

/**
 * Cancels a booking/appointment
 * @param bookingId - The ID of the booking to cancel
 * @param reason - Optional cancellation reason
 */
export async function cancelBooking(bookingId: string, reason?: string) {
  try {
    // Convert bookingId to number if it's a numeric string
    const appointmentId = isNaN(Number(bookingId)) ? bookingId : Number(bookingId);

    const response = await apiFetch("/api/appointments/" + appointmentId, {
      method: "DELETE",
      body: reason
        ? JSON.stringify({ cancellation_reason: reason })
        : undefined,
    });

    return response;
  } catch (error) {
    console.error("Failed to cancel booking:", error);
    throw error;
  }
}
