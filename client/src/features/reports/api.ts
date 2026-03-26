import apiClient from '@/lib/api-client';

export const reportApi = {
  getPnl: (from_date: string, to_date: string) =>
    apiClient.get('/reports/pnl', { params: { from_date, to_date } }),

  getDebtAging: () =>
    apiClient.get('/reports/debt-aging'),

  getProductSales: (from_date: string, to_date: string) =>
    apiClient.get('/reports/product-sales', { params: { from_date, to_date } }),
};
