export interface Organization {
  id: string; // UUID
  name: string;
  admin_user_id: string; // UUID
  description?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}
