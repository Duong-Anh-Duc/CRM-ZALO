import apiClient from '@/lib/api-client';

export const dashboardApi = {
  getOverview: (params?: { from_date?: string; to_date?: string }) =>
    apiClient.get('/dashboard', { params }),
};
