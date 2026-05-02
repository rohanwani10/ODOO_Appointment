export type ResourceType = 'PROVIDER' | 'ROOM' | 'EQUIPMENT';

export interface Resource {
  id: number;
  organization_id: number;
  name: string;
  type: ResourceType;
  description?: string | null;
  capacity: number;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface ResourceWorkingHour {
  id: number;
  resource_id: number;
  day_of_week: number; // 0-6
  start_time: string; // "HH:MM:SS"
  end_time: string;
  break_start?: string;
  break_end?: string;
  is_available: boolean;
}

export interface ResourceUnavailability {
  id: number;
  resource_id: number;
  start_date_time: string;
  end_date_time: string;
  reason?: string;
}
