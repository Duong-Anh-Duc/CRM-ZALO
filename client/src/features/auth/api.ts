import apiClient from '@/lib/api-client';
import { AuthUser, LoginInput, ChangePasswordInput, CreateUserInput, LoginResponse } from '@/types';
import type { AxiosResponse } from 'axios';

export const authApi = {
  login: (data: LoginInput): Promise<AxiosResponse<{ success: boolean; data: LoginResponse }>> =>
    apiClient.post<{ success: boolean; data: LoginResponse }>('/auth/login', data),

  getProfile: (): Promise<AxiosResponse<{ success: boolean; data: AuthUser & { permissions?: string[]; role_detail?: { id: string; slug: string; name: string; description?: string } } }>> =>
    apiClient.get<{ success: boolean; data: AuthUser & { permissions?: string[]; role_detail?: { id: string; slug: string; name: string; description?: string } } }>('/auth/profile'),

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
