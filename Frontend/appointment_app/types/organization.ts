export interface Organization {
  id: number;
  name: string;
  admin_user_id: number;
  description?: string | null;
  logo_url?: string | null;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string;
}
