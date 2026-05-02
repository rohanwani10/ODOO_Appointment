export const CALENDAR_CONFIG = {
  step: 15,
  timeslots: 4,
} as const;

// Full 24-hour range: 00:00 to 23:59
export const MIN_TIME = new Date(1970, 0, 1, 0, 0, 0);
export const MAX_TIME = new Date(1970, 0, 1, 23, 59, 59);

// Days of week (Monday = 0, Sunday = 6)
export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

// ============================================================================
// Calendar Event Colors
// ============================================================================

/** Colors for availability time blocks */
export const AVAILABILITY_COLORS = {
  background: "#dbeafe", // blue-100
  border: "#3b82f6", // blue-500
  backgroundHover: "#eff6ff", // blue-50
} as const;

/** Colors for busy blocks (external calendar events) */
export const BUSY_BLOCK_COLORS = {
  background: "#ffedd5", // orange-100
  border: "#fb923c", // orange-400
  text: "#9a3412", // orange-800
} as const;

/** Colors for booked meeting blocks based on attendee status */
export const BOOKING_STATUS_COLORS = {
  declined: {
    background: "#e11d48", // rose-600
    border: "#be123c", // rose-700
    text: "#ffffff",
  },
  tentative: {
    background: "#f59e0b", // amber-500
    border: "#d97706", // amber-600
    text: "#ffffff",
  },
  accepted: {
    background: "#2563eb", // blue-600
    border: "#1d4ed8", // blue-700
    text: "#ffffff",
  },
  default: {
    background: "#334155", // slate-700
    border: "#0f172a", // slate-950
    text: "#ffffff",
  },
} as const;
