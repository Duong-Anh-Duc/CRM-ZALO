import apiClient from '@/lib/api-client';

export const zaloApi = {
  getConfig: () => apiClient.get('/zalo/config'),
  saveConfig: (data: Record<string, unknown>) => apiClient.post('/zalo/config', data),
  getMessages: (params?: Record<string, unknown>) => apiClient.get('/zalo/messages', { params }),
  getStats: () => apiClient.get('/zalo/stats'),
  getThreads: (params?: { limit?: number; type?: string }) => apiClient.get('/zalo/threads', { params }),
  getThreadMessages: (contact_pid: string, limit?: number) =>
    apiClient.get('/zalo/thread-messages', { params: { contact_pid, limit: limit || 50 } }),
  getGroupInfo: (group_id: string) => apiClient.get('/zalo/group-info', { params: { group_id } }),
  getUserInfo: (user_id: string) => apiClient.get('/zalo/user-info', { params: { user_id } }),
};
