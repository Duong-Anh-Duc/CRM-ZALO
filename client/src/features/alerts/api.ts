import apiClient from '@/lib/api-client';

export const alertApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get('/alerts', { params }),

  getUnreadCount: () =>
    apiClient.get('/alerts/unread-count'),

  markAsRead: (id: string) =>
    apiClient.patch(`/alerts/${id}/read`),

  markAllAsRead: () =>
    apiClient.patch('/alerts/mark-all-read'),

  delete: (id: string) =>
    apiClient.delete(`/alerts/${id}`),

  takeAction: (id: string, action: string, new_expected_date?: string) =>
    apiClient.patch(`/alerts/${id}/action`, { action, new_expected_date }),
};
