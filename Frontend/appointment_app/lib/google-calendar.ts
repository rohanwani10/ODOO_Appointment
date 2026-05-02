/**
 * Types and utilities for Google Calendar integration.
 * Currently implemented as a placeholder to fix build errors.
 */

export type AttendeeStatus = "accepted" | "declined" | "tentative" | "needsAction";

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string };
  end: { dateTime: string };
}
