import apiClient from '@/lib/api-client';

export const payrollApi = {
  getConfig: () => apiClient.get('/payroll/config'),
  updateConfig: (data: any) => apiClient.put('/payroll/config', data),

  listEmployees: (params?: any) => apiClient.get('/payroll/employees', { params }),
  getEmployee: (id: string) => apiClient.get(`/payroll/employees/${id}`),
  createEmployee: (data: any) => apiClient.post('/payroll/employees', data),
  updateEmployee: (id: string, data: any) => apiClient.put(`/payroll/employees/${id}`, data),

  listPeriods: (params?: any) => apiClient.get('/payroll/periods', { params }),
  createPeriod: (data: any) => apiClient.post('/payroll/periods', data),
  deletePeriod: (id: string) => apiClient.delete(`/payroll/periods/${id}`),
  calculatePeriod: (id: string) => apiClient.post(`/payroll/periods/${id}/calculate`),
  approvePeriod: (id: string) => apiClient.post(`/payroll/periods/${id}/approve`),
  payPeriod: (id: string) => apiClient.post(`/payroll/periods/${id}/pay`),
  getPeriodRecords: (id: string) => apiClient.get(`/payroll/periods/${id}/records`),
  getPayslip: (periodId: string, empId: string) =>
    apiClient.get(`/payroll/periods/${periodId}/records/${empId}`),
  getPeriodSummary: (id: string) => apiClient.get(`/payroll/periods/${id}/summary`),
};
