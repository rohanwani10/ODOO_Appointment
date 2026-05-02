// JS fallback stubs for availability actions to satisfy Next/Turbopack static analysis
export async function getMeetingTypes(hostId) {
  return [];
}
export async function createMeetingType(data) {
  return { id: null, slug: "", _id: null, isDefault: data?.isDefault || false };
}
export async function getBookingLinkWithMeetingType(meetingTypeId) {
  return { url: "" };
}
export async function getBookingQuota(hostId) {
  return { used: 0, limit: 0 };
}
export async function hasConnectedAccount(hostId) {
  return false;
}
export async function saveAvailability(data) {
  return true;
}
