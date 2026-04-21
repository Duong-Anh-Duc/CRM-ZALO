import apiClient from '@/lib/api-client';
import type {
  CreateRoleInput,
  UpdateRoleMetaInput,
} from './types';

export const roleApi = {
  list: () => apiClient.get('/roles'),

  getById: (id: string) => apiClient.get(`/roles/${id}`),

  permissions: () => apiClient.get('/roles/permissions'),

  create: (data: CreateRoleInput) => apiClient.post('/roles', data),

  update: (id: string, data: UpdateRoleMetaInput) =>
    apiClient.put(`/roles/${id}`, data),

  updatePermissions: (id: string, permission_ids: string[]) =>
    apiClient.put(`/roles/${id}/permissions`, { permission_ids }),

  remove: (id: string) => apiClient.delete(`/roles/${id}`),
};
