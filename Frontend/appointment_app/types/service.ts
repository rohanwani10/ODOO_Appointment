export interface Service {
  id: number;
  organization_id: number;
  name: string;
  description?: string | null;
  duration_minutes: number;
  capacity: number;
  is_published: boolean;
  shareable_link?: string | null;
  max_bookings_per_user?: number | null;
  requires_advance_payment: boolean;
  advance_payment_amount?: number | null;
  created_by: number;
  created_at: string;
}

export interface FormQuestion {
  id: number;
  service_id: number;
  question_text: string;
  field_type: string;
  is_required: boolean;
  options?: string | null;
  display_order: number;
}

export interface AvailableSlot {
  start_time: string;
  end_time: string;
  resource_id: number;
  resource_name: string;
  available_capacity: number;
}
