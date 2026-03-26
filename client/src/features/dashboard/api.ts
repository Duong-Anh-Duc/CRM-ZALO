import apiClient from '@/lib/api-client';

export const dashboardApi = {
  getOverview: () => apiClient.get('/dashboard'),
};
