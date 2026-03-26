import apiClient from '@/lib/api-client';
import { RecordPaymentInput } from '@/types';

export const receivableApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get('/receivables', { params }),

  getSummary: () =>
    apiClient.get('/receivables/summary'),

  recordPayment: (data: RecordPaymentInput) =>
    apiClient.post('/receivables/payments', data),
};

export const payableApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get('/payables', { params }),

  getSummary: () =>
    apiClient.get('/payables/summary'),

  recordPayment: (data: RecordPaymentInput) =>
    apiClient.post('/payables/payments', data),
};
