import apiClient from '@/lib/api-client';
import { AuthUser, LoginInput, ChangePasswordInput, CreateUserInput } from '@/types';

export const authApi = {
  login: (data: LoginInput) =>
    apiClient.post<{ success: boolean; data: { token: string; user: AuthUser } }>('/auth/login', data),

  getProfile: () =>
    apiClient.get<{ success: boolean; data: AuthUser }>('/auth/profile'),

  changePassword: (data: ChangePasswordInput) =>
    apiClient.put('/auth/password', data),

  updateProfile: (data: { full_name: string }) =>
    apiClient.put('/auth/profile', data),

  logout: () => apiClient.post('/auth/logout'),
};

export const userApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    apiClient.get('/users', { params }),

  create: (data: CreateUserInput) =>
    apiClient.post('/users', data),

  update: (id: string, data: Partial<CreateUserInput> & { is_active?: boolean }) =>
    apiClient.put(`/users/${id}`, data),

  deactivate: (id: string) =>
    apiClient.delete(`/users/${id}`),
};
