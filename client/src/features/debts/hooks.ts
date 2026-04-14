import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import i18n from '@/locales';
import { getErrorMessage } from '@/lib/api-client';
import { receivableApi, payableApi } from './api';

// ── Receivables ──

export function useReceivables(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['receivables', filters],
    queryFn: () => receivableApi.list(filters).then(r => r.data),
  });
}

export function useReceivablesByCustomer(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['receivables-by-customer', filters],
    queryFn: () => receivableApi.listByCustomer(filters).then(r => r.data),
  });
}

export function useCustomerDebtDetail(customerId?: string) {
  return useQuery({
    queryKey: ['customer-debt', customerId],
    queryFn: () => receivableApi.getCustomerDetail(customerId!).then(r => r.data),
    enabled: !!customerId,
  });
}

export function useReceivableSummary() {
  return useQuery({
    queryKey: ['receivable-summary'],
    queryFn: () => receivableApi.getSummary().then(r => r.data),
  });
}

export function useRecordReceivablePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { customer_id: string; amount: number; payment_date?: string; method: string; reference?: string }) =>
      receivableApi.recordPayment(data).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('debt.recordPaymentSuccess'));
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['receivables-by-customer'] });
      queryClient.invalidateQueries({ queryKey: ['customer-debt'] });
      queryClient.invalidateQueries({ queryKey: ['receivable-summary'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}

// ── Payables ──

export function usePayables(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['payables', filters],
    queryFn: () => payableApi.list(filters).then(r => r.data),
  });
}

export function usePayablesBySupplier(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['payables-by-supplier', filters],
    queryFn: () => payableApi.listBySupplier(filters).then(r => r.data),
  });
}

export function useSupplierDebtDetail(supplierId?: string) {
  return useQuery({
    queryKey: ['supplier-debt', supplierId],
    queryFn: () => payableApi.getSupplierDetail(supplierId!).then(r => r.data),
    enabled: !!supplierId,
  });
}

export function usePayableSummary() {
  return useQuery({
    queryKey: ['payable-summary'],
    queryFn: () => payableApi.getSummary().then(r => r.data),
  });
}

export function useRecordPayablePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { supplier_id: string; amount: number; payment_date?: string; method: string; reference?: string }) =>
      payableApi.recordPayment(data).then(r => r.data),
    onSuccess: () => {
      toast.success(i18n.t('debt.recordPaymentSuccess'));
      queryClient.invalidateQueries({ queryKey: ['payables'] });
      queryClient.invalidateQueries({ queryKey: ['payables-by-supplier'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-debt'] });
      queryClient.invalidateQueries({ queryKey: ['payable-summary'] });
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err)),
  });
}
