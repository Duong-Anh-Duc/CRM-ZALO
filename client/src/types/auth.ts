export type UserRole = 'ADMIN' | 'STAFF' | 'VIEWER';

export interface RoleDetail {
  id: string;
  slug: string;
  name: string;
  description?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;              // legacy uppercase for compat — keep for now
  role_slug?: string;        // 'admin' | 'manager' | 'accountant' | 'sales' | 'viewer'
  role_name?: string;
  role_detail?: RoleDetail;
  is_active: boolean;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  permissions: string[];
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ChangePasswordInput {
  old_password: string;
  new_password: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  full_name: string;
  role_slug: string;
}
