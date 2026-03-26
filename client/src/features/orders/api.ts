import apiClient from '@/lib/api-client';
import { CreateSalesOrderInput, CreatePurchaseOrderInput } from '@/types';

export const salesOrderApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get('/sales-orders', { params }),

  getById: (id: string) =>
    apiClient.get(`/sales-orders/${id}`),

  create: (data: CreateSalesOrderInput) =>
    apiClient.post('/sales-orders', data),

  updateStatus: (id: string, status: string) =>
    apiClient.patch(`/sales-orders/${id}/status`, { status }),
};

export const purchaseOrderApi = {
  list: (params?: Record<string, unknown>) =>
    apiClient.get('/purchase-orders', { params }),

  getById: (id: string) =>
    apiClient.get(`/purchase-orders/${id}`),

  create: (data: CreatePurchaseOrderInput) =>
    apiClient.post('/purchase-orders', data),

  updateStatus: (id: string, status: string) =>
    apiClient.patch(`/purchase-orders/${id}/status`, { status }),
};
