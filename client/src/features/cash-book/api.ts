import apiClient from '@/lib/api-client';

export const cashBookApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/cash-book', { params }),
  create: (data: any) => apiClient.post('/cash-book', data),
  update: (id: string, data: any) => apiClient.put(`/cash-book/${id}`, data),
  delete: (id: string) => apiClient.delete(`/cash-book/${id}`),
  getSummary: (params?: Record<string, unknown>) => apiClient.get('/cash-book/summary', { params }),
  listCategories: (type?: string) => apiClient.get('/cash-book/categories', { params: type ? { type } : {} }),
  createCategory: (data: any) => apiClient.post('/cash-book/categories', data),
};
