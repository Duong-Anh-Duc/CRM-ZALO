import apiClient from '@/lib/api-client';

export const salesReturnApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/returns/sales', { params }),
  getById: (id: string) => apiClient.get(`/returns/sales/${id}`),
  create: (data: any) => apiClient.post('/returns/sales', data),
  updateStatus: (id: string, status: string) => apiClient.patch(`/returns/sales/${id}/status`, { status }),
  delete: (id: string) => apiClient.delete(`/returns/sales/${id}`),
};

export const purchaseReturnApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/returns/purchase', { params }),
  getById: (id: string) => apiClient.get(`/returns/purchase/${id}`),
  create: (data: any) => apiClient.post('/returns/purchase', data),
  updateStatus: (id: string, status: string) => apiClient.patch(`/returns/purchase/${id}/status`, { status }),
  delete: (id: string) => apiClient.delete(`/returns/purchase/${id}`),
};
