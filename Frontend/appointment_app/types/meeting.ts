export interface Service {
  id: number;
  organization_id: number;
  name: string;
  description?: string;
  duration_minutes: number;
  capacity: number;
  is_published: boolean;
  shareable_link?: string;
  max_bookings_per_user?: number;
  requires_advance_payment: boolean;
  advance_payment_amount?: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Backward compatibility or alias if needed
export type MeetingType = Service;
