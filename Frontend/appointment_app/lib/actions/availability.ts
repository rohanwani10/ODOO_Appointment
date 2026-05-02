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
  return true;
}
