import apiClient from '@/lib/api-client';

export const customerApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get('/customers', { params }),

  getById: (id: string) =>
    apiClient.get(`/customers/${id}`),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/customers', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/customers/${id}`, data),

  softDelete: (id: string) =>
    apiClient.delete(`/customers/${id}`),

  checkDebtLimit: (customer_id: string, order_total: number) =>
    apiClient.post('/customers/check-debt-limit', { customer_id, order_total }),
};
