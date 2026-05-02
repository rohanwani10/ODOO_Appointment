/**
 * Meeting-type shape used by the host-facing UI.
 *
 * This is a local placeholder that mirrors what a Sanity query would return.
 * Replace with the real Sanity-generated type once the CMS layer is wired up.
 */
export interface MeetingTypeForHost {
  _id: string;
  name: string;
  slug: string;
  duration: number;
  isDefault: boolean;
}
