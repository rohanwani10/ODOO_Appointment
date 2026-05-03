export type UserRole = "CUSTOMER" | "ORGANIZER" | "ADMIN";

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  profile_picture_url?: string | null;
  preferences?: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  roles: UserRole[];
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: Omit<User, "roles">;
}

export interface Organization {
  id: number;
  name: string;
  admin_user_id: number;
  description?: string | null;
  logo_url?: string | null;
  created_at: string;
}

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

export interface ServiceResourceAssignment {
  id: number;
  service_id: number;
  resource_id: number;
  is_required: boolean;
  assignment_type: "MANUAL" | "AUTO";
  created_at: string;
}

export interface Resource {
  id: number;
  organization_id: number;
  name: string;
  type: "PROVIDER" | "ROOM" | "EQUIPMENT";
  description?: string | null;
  capacity: number;
  is_active: boolean;
  created_at: string;
}

export interface WorkingHours {
  id: number;
  resource_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
  is_available: boolean;
}

export interface Unavailability {
  id: number;
  resource_id: number;
  start_date_time: string;
  end_date_time: string;
  reason?: string | null;
  created_at: string;
}

export interface AvailableSlot {
  start_time: string;
  end_time: string;
  resource_id: number;
  resource_name: string;
  available_capacity: number;
}

export interface FormQuestion {
  id: number;
  service_id: number;
  question_text: string;
  field_type: "TEXT" | "EMAIL" | "PHONE" | "TEXTAREA" | "SELECT" | "CHECKBOX" | "DATE";
  is_required: boolean;
  options?: string | null;
  display_order: number;
}

export interface Appointment {
  id: number;
  service_id: number;
  customer_id: number;
  resource_id?: number | null;
  start_time: string;
  end_time: string;
  status: string;
  capacity_used: number;
  notes?: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface PaymentRecord {
  id: number;
  appointment_id: number;
  provider: string;
  status: "CREATED" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "CANCELLED";
  amount: number;
  currency: string;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  verified_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface PaymentStatus {
  appointment_id: number;
  requires_payment: boolean;
  amount: number;
  currency: string;
  is_paid: boolean;
  latest_payment?: PaymentRecord | null;
}

export interface RazorpayOrderResponse {
  appointment_id: number;
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
  payment: PaymentRecord;
}

export interface AppointmentConfirmation {
  appointment_id: number;
  status: string;
  customer_name?: string | null;
  service_name?: string | null;
  resource_name?: string | null;
  start_time: string;
  end_time: string;
  capacity_used: number;
  notes?: string | null;
  created_at: string;
}

export interface BookingFormResponse {
  id: number;
  appointment_id: number;
  question_id: number;
  question_text: string;
  response: string;
  created_at: string;
}

export interface AdminDashboard {
  total_users: number;
  total_organizations: number;
  total_services: number;
  total_resources: number;
  total_providers: number;
  total_appointments: number;
  upcoming_appointments: number;
}

export interface AdminUsersResponse {
  users: User[];
  total: number;
  skip: number;
  limit: number;
}

export interface AdminSystemMetrics {
  role_counts: {
    customers: number;
    organizers: number;
    admins: number;
  };
  active_services: number;
  active_providers: number;
  total_appointments: number;
  cancelled_appointments: number;
}

export interface AuditLogItem {
  id: number;
  user_id?: number | null;
  entity_type: string;
  entity_id: string;
  action: string;
  changes?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface AppointmentReportItem {
  date: string;
  count: number;
}

export interface ResourceUtilizationItem {
  resource_id: number;
  resource_name?: string | null;
  total_appointments: number;
  total_minutes_booked: number;
}

export interface BookingReportItem {
  service_id: number;
  service_name: string;
  count: number;
}

export interface CustomerInsightItem {
  customer_id: number;
  email?: string | null;
  count: number;
}

export interface RevenueResponse {
  revenue: number;
}

export interface GoogleAuthorizationResponse {
  authorization_url: string;
}

export interface GoogleCalendarItem {
  id: string;
  summary?: string;
  primary?: boolean;
}
