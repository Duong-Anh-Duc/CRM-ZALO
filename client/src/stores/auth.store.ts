import { create } from 'zustand';
import { AuthState } from './types';

function loadPermissions(): string[] {
  try {
    const raw = localStorage.getItem('permissions');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),
  permissions: loadPermissions(),

  setAuth: (user, token, permissions) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    if (permissions !== undefined) {
      localStorage.setItem('permissions', JSON.stringify(permissions));
      set({ user, token, permissions });
    } else {
      set({ user, token });
    }
  },

  setPermissions: (permissions) => {
    localStorage.setItem('permissions', JSON.stringify(permissions));
    set({ permissions });
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('permissions');
    set({ user: null, token: null, permissions: [] });
  },

  isAuthenticated: () => !!get().token,
  hasRole: (...roles) => {
    const user = get().user;
    return !!user && roles.includes(user.role);
  },
  hasPermission: (key) => {
    return get().permissions.includes(key);
  },
}));
