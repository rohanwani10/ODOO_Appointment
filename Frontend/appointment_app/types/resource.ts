export type ResourceType = 'PROVIDER' | 'ROOM' | 'EQUIPMENT';

export interface Resource {
  id: string; // UUID
  organization_id: string; // UUID
  name: string;
  type: ResourceType;
  description?: string;
  capacity: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface ResourceWorkingHour {
  id: string;
  resource_id: string;
  day_of_week: number; // 0-6
  start_time: string; // "HH:MM:SS"
  end_time: string;
  break_start?: string;
  break_end?: string;
  is_available: boolean;
}

export interface ResourceUnavailability {
  id: string;
  resource_id: string;
  start_date_time: string;
  end_date_time: string;
  reason?: string;
}
