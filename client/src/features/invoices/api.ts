import apiClient from '@/lib/api-client';

export const invoiceApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/invoice', { params }),
  getById: (id: string) => apiClient.get(`/invoice/${id}`),
  createFromOrder: (orderId: string) => apiClient.post(`/invoice/from-order/${orderId}`),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch(`/invoice/${id}`, data),
  finalize: (id: string) => apiClient.post(`/invoice/${id}/finalize`),
  cancel: (id: string) => apiClient.post(`/invoice/${id}/cancel`),
  getPdfUrl: (id: string) => `/api/invoice/${id}/pdf`,
};
