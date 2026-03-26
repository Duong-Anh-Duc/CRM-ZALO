import apiClient from '@/lib/api-client';

export const operatingCostApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get('/operating-costs', { params }),

  getMonthlySummary: (year: number) =>
    apiClient.get('/operating-costs/monthly-summary', { params: { year } }),

  getCategories: () =>
    apiClient.get('/operating-costs/categories'),

  createCategory: (name: string) =>
    apiClient.post('/operating-costs/categories', { name }),

  create: (data: Record<string, unknown>) =>
    apiClient.post('/operating-costs', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/operating-costs/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/operating-costs/${id}`),
};
