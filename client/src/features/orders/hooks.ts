import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import i18n from '@/locales';
import { getErrorMessage } from '@/lib/api-client';
import { salesOrderApi, purchaseOrderApi } from './api';
import { CreateSalesOrderInput, CreatePurchaseOrderInput } from '@/types';

export function useSalesOrders(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['sales-orders', filters],
    queryFn: () => salesOrderApi.list(filters).then(r => r.data),
  });
}

export function useSalesOrder(id?: string) {
  return useQuery({
    queryKey: ['sales-orders', id],
    queryFn: () => salesOrderApi.getById(id!).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateSalesOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSalesOrderInput) => salesOrderApi.create(data).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('order.createSalesSuccess'));
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdateSalesOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      salesOrderApi.updateStatus(id, status).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('order.updateSalesStatusSuccess'));
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function usePurchaseOrders(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['purchase-orders', filters],
    queryFn: () => purchaseOrderApi.list(filters).then(r => r.data),
  });
}

export function usePurchaseOrder(id?: string) {
  return useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: () => purchaseOrderApi.getById(id!).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePurchaseOrderInput) => purchaseOrderApi.create(data).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('order.createPurchaseSuccess'));
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

export function useUpdatePurchaseOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      purchaseOrderApi.updateStatus(id, status).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('order.updatePurchaseStatusSuccess'));
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['payables'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}
