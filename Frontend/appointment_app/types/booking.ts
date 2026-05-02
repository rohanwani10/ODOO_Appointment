export type AppointmentStatus = 
  | 'PENDING' 
  | 'CONFIRMED' 
  | 'CANCELLED' 
  | 'RESCHEDULED' 
  | 'COMPLETED' 
  | 'NO_SHOW';

export interface Appointment {
  id: number;
  service_id: number;
  customer_id: number;
  resource_id?: number;
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
  id: number;
  appointment_id: number;
  question_id: number;
  response: string;
  created_at: string;
}

// Alias for UI consistency
export type Booking = Appointment;
