import apiClient from '@/lib/api-client';
import type { AuditLogFilters } from './types';

export const auditLogApi = {
  list: (params: AuditLogFilters) => apiClient.get('/audit-logs', { params }),
  getById: (id: string) => apiClient.get(`/audit-logs/${id}`),
  models: () => apiClient.get('/audit-logs/models'),
  users: () => apiClient.get('/audit-logs/users'),
};
