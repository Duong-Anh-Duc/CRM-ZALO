import { AuthUser } from '@/types';

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  hasRole: (...roles: string[]) => boolean;
}
