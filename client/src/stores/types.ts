import { AuthUser } from '@/types';

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  permissions: string[];
  setAuth: (user: AuthUser, token: string, permissions?: string[]) => void;
  setPermissions: (permissions: string[]) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  hasRole: (...roles: string[]) => boolean;
  hasPermission: (key: string) => boolean;
}
