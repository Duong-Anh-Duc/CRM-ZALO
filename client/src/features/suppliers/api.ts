import apiClient from '@/lib/api-client';

export const supplierApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get('/suppliers', { params }),

  getById: (id: string) =>
    apiClient.get(`/suppliers/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/suppliers', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/suppliers/${id}`, data),

  softDelete: (id: string) =>
    apiClient.delete(`/suppliers/${id}`),
};
