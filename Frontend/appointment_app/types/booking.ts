export type AppointmentStatus = 
  | 'PENDING' 
  | 'CONFIRMED' 
  | 'CANCELLED' 
  | 'RESCHEDULED' 
  | 'COMPLETED' 
  | 'NO_SHOW';

export interface Appointment {
  id: string; // UUID
  service_id: string; // UUID
  customer_id: string; // UUID
  resource_id?: string; // UUID
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  capacity_used: number;
  notes?: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BookingFormResponse {
  id: string;
  appointment_id: string;
  question_id: string;
  response: string;
  created_at: string;
}

// Alias for UI consistency
export type Booking = Appointment;
