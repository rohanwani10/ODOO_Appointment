export type UserRole = "CUSTOMER" | "ORGANIZER" | "ADMIN";

export interface BackendUserBase {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  created_at: string;
}

export interface AuthUser extends BackendUserBase {
  is_verified: boolean;
  is_active: boolean;
}

export interface User extends AuthUser {
  roles: UserRole[];
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
}

export interface TokenResponse extends LoginResponse { }

export interface AdminUsersResponse {
  total: number;
  skip: number;
  limit: number;
  users: User[];
}

export interface ApiErrorResponse {
  detail?: string | { msg?: string } | Array<{ msg?: string }>;
  message?: string;
}
