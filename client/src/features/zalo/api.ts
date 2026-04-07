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
  syncMessages: () => apiClient.post('/zalo/sync-messages'),
  aiChat: (question: string, limit?: number) => apiClient.post('/zalo/ai-chat', { question, limit: limit || 100 }),
  aiSummary: (hours?: number, limit?: number) => apiClient.get('/zalo/ai-summary', { params: { hours: hours || 24, limit: limit || 100 } }),
  getTrainingCategories: () => apiClient.get('/zalo/ai-training/categories'),
  listTraining: (category?: string) => apiClient.get('/zalo/ai-training', { params: category ? { category } : {} }),
  createTraining: (data: { category: string; title: string; content: string }) => apiClient.post('/zalo/ai-training', data),
  updateTraining: (id: string, data: { title?: string; content?: string }) => apiClient.patch(`/zalo/ai-training/${id}`, data),
  removeTraining: (id: string) => apiClient.delete(`/zalo/ai-training/${id}`),
};
