import { create } from 'zustand';
import { AuthState } from './types';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token'),

  setAuth: (user, token) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  isAuthenticated: () => !!get().token,
  hasRole: (...roles) => {
    const user = get().user;
    return !!user && roles.includes(user.role);
  },
}));
