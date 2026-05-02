/**
 * Booking quota status returned by the availability action layer.
 *
 * This is a local placeholder for the feature-gating system.
 */
export interface BookingQuotaStatus {
  /** Number of bookings used this billing period */
  used: number;
  /** Maximum bookings allowed (Infinity = unlimited) */
  limit: number;
  /** Remaining bookings */
  remaining: number;
  /** Current plan name */
  plan: string;
}
