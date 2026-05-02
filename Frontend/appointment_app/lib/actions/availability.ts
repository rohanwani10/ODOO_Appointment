// Minimal stubs for availability actions used by the UI.
// These are placeholders to allow the frontend to build during development.

export async function getMeetingTypes(hostId?: string) {
  return [] as any[];
}

export async function createMeetingType(data: any) {
  return { id: null };
}

export async function getBookingLinkWithMeetingType(meetingTypeId: string) {
  return "";
}

export async function getBookingQuota(hostId?: string) {
  return { used: 0, limit: 0 };
}

export async function hasConnectedAccount(hostId?: string) {
  return false;
}

export async function saveAvailability(data: any) {
import type { TimeBlock } from "@/components/calendar/types";
import type { MeetingTypeForHost } from "@/sanity/queries/meetingTypes";
import type { BookingQuotaStatus } from "@/lib/features";

/**
 * Saves availability time blocks.
 * Placeholder – will be wired to the backend working-hours API.
 */
export async function saveAvailability(
  blocks: TimeBlock[],
): Promise<TimeBlock[]> {
  console.log("Syncing availability with backend pulse...", blocks);
  await new Promise((resolve) => setTimeout(resolve, 800));
  return blocks;
}

/**
 * Returns the meeting types owned by the current user.
 */
export async function getMeetingTypes(): Promise<MeetingTypeForHost[]> {
  // Placeholder – returns empty list until Sanity/backend integration is wired
  return [];
}

/**
 * Creates a new meeting type for the current user.
 */
export async function createMeetingType(input: {
  name: string;
  duration: number;
  isDefault: boolean;
}): Promise<MeetingTypeForHost> {
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return {
    _id: `local-${crypto.randomUUID()}`,
    name: input.name,
    slug,
    duration: input.duration,
    isDefault: input.isDefault,
  };
}

/**
 * Returns a shareable booking URL for the given meeting-type slug.
 */
export async function getBookingLinkWithMeetingType(
  meetingTypeSlug: string,
): Promise<{ url: string }> {
  const base =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  return { url: `${base}/book/${meetingTypeSlug}` };
}

/**
 * Returns the current user's booking quota status.
 */
export async function getBookingQuota(): Promise<BookingQuotaStatus> {
  return {
    used: 0,
    limit: Infinity,
    remaining: Infinity,
    plan: "free",
  };
}

/**
 * Returns whether the current user has a connected calendar account.
 */
export async function hasConnectedAccount(): Promise<boolean> {
  // Default to true so the share-link dialog is usable
  return true;
}
