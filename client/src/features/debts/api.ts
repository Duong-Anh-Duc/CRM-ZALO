import apiClient from '@/lib/api-client';

export const receivableApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get('/receivables', { params }),

  listByCustomer: (params?: Record<string, unknown>) =>
    apiClient.get('/receivables/by-customer', { params }),

  getCustomerDetail: (customerId: string) =>
    apiClient.get(`/receivables/customer/${customerId}`),

  getSummary: () =>
    apiClient.get('/receivables/summary'),

  recordPayment: (data: { customer_id: string; amount: number; payment_date?: string; method: string; reference?: string }) =>
    apiClient.post('/receivables/payments', data),

  exportPdf: (customerId: string) =>
    apiClient.get(`/receivables/customer/${customerId}/export-pdf`, { responseType: 'blob' }),

  exportExcel: (customerId: string) =>
    apiClient.get(`/receivables/customer/${customerId}/export-excel`, { responseType: 'blob' }),

  updatePaymentEvidence: (paymentId: string, evidenceUrl: string) =>
    apiClient.patch(`/receivables/payments/${paymentId}/evidence`, { evidence_url: evidenceUrl }),
};

export const payableApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get('/payables', { params }),

  listBySupplier: (params?: Record<string, unknown>) =>
    apiClient.get('/payables/by-supplier', { params }),

  getSupplierDetail: (supplierId: string) =>
    apiClient.get(`/payables/supplier/${supplierId}`),

  getSummary: () =>
    apiClient.get('/payables/summary'),

  recordPayment: (data: { supplier_id: string; amount: number; payment_date?: string; method: string; reference?: string }) =>
    apiClient.post('/payables/payments', data),

  exportPdf: (supplierId: string) =>
    apiClient.get(`/payables/supplier/${supplierId}/export-pdf`, { responseType: 'blob' }),

  exportExcel: (supplierId: string) =>
    apiClient.get(`/payables/supplier/${supplierId}/export-excel`, { responseType: 'blob' }),

  updatePaymentEvidence: (paymentId: string, evidenceUrl: string) =>
    apiClient.patch(`/payables/payments/${paymentId}/evidence`, { evidence_url: evidenceUrl }),
};
